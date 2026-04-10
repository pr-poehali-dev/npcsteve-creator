"""
Magic Link авторизация: отправка ссылки на email и верификация токена.
POST /send   — отправляет magic link на email
POST /verify — проверяет токен, создаёт сессию и возвращает пользователя
GET  /me     — возвращает текущего пользователя по session_token
"""
import json
import os
import uuid
import secrets
import urllib.request
import psycopg2


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def send_magic_link_email(to_email: str, magic_url: str) -> None:
    payload = json.dumps({
        'from': 'LUMIX AI <onboarding@resend.dev>',
        'to': [to_email],
        'subject': 'Ваша ссылка для входа в LUMIX AI',
        'html': f'''
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0d0d1a;color:#fff;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#00f5ff,#b24bff);padding:2px">
            <div style="background:#0d0d1a;padding:40px 32px">
              <div style="font-size:24px;font-weight:bold;letter-spacing:4px;margin-bottom:8px">LUMIX<span style="background:linear-gradient(135deg,#00f5ff,#b24bff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">AI</span></div>
              <p style="color:#888;margin:0 0 32px">Ваша ссылка для входа</p>

              <p style="color:#ccc;line-height:1.6;margin:0 0 24px">
                Нажмите кнопку ниже, чтобы войти в LUMIX AI.<br>
                Ссылка действует <strong style="color:#fff">15 минут</strong>.
              </p>

              <a href="{magic_url}"
                style="display:inline-block;background:linear-gradient(135deg,#00f5ff,#b24bff);color:#000;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:12px;font-size:15px;letter-spacing:1px">
                Войти в LUMIX AI →
              </a>

              <p style="color:#555;font-size:12px;margin:32px 0 0;line-height:1.6">
                Если вы не запрашивали вход — просто проигнорируйте это письмо.<br>
                Ссылка одноразовая и автоматически истечёт.
              </p>
            </div>
          </div>
        </div>
        ''',
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.resend.com/emails',
        data=payload,
        headers={
            'Authorization': f"Bearer {os.environ['RESEND_API_KEY']}",
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()


def upsert_user_by_email(conn, email: str) -> dict:
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (yandex_id, email, name, email_verified)
        VALUES (%s, %s, %s, TRUE)
        ON CONFLICT (yandex_id) DO UPDATE
          SET email = EXCLUDED.email,
              email_verified = TRUE,
              updated_at = NOW()
        RETURNING id, email, name, avatar_url
    """, (f'email:{email}', email, email.split('@')[0]))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    return {'id': row[0], 'email': row[1], 'name': row[2] or '', 'avatar_url': row[3]}


def create_session(conn, user_id: int) -> str:
    token = str(uuid.uuid4())
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(64) PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
        )
    """)
    cur.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user_id))
    conn.commit()
    cur.close()
    return token


def get_user_by_session(conn, token: str) -> dict | None:
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, u.name, u.avatar_url
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': row[0], 'email': row[1], 'name': row[2] or '', 'avatar_url': row[3]}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')

    # GET /me
    if method == 'GET':
        token = (event.get('headers') or {}).get('X-Session-Token', '')
        if not token:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет токена'})}
        conn = get_db()
        user = get_user_by_session(conn, token)
        conn.close()
        if not user:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(user)}

    if method != 'POST':
        return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    # POST /send — отправить magic link
    if '/send' in path:
        email = (body.get('email') or '').strip().lower()
        if not email or '@' not in email:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Укажите корректный email'})}

        site_url = body.get('site_url', '').rstrip('/')
        token = secrets.token_urlsafe(32)

        conn = get_db()
        cur = conn.cursor()
        # Удаляем старые неиспользованные токены для этого email
        cur.execute("UPDATE magic_links SET used = TRUE WHERE email = %s AND used = FALSE AND expires_at > NOW()", (email,))
        cur.execute(
            "INSERT INTO magic_links (email, token) VALUES (%s, %s)",
            (email, token)
        )
        conn.commit()
        cur.close()
        conn.close()

        magic_url = f"{site_url}?magic_token={token}"
        send_magic_link_email(email, magic_url)

        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True, 'message': 'Письмо отправлено'})}

    # POST /verify — проверить токен
    if '/verify' in path:
        token = (body.get('token') or '').strip()
        if not token:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Токен обязателен'})}

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT email FROM magic_links
            WHERE token = %s AND used = FALSE AND expires_at > NOW()
        """, (token,))
        row = cur.fetchone()

        if not row:
            cur.close()
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Ссылка недействительна или истекла'})}

        email = row[0]
        cur.execute("UPDATE magic_links SET used = TRUE WHERE token = %s", (token,))
        conn.commit()
        cur.close()

        user = upsert_user_by_email(conn, email)
        session_token = create_session(conn, user['id'])
        conn.close()

        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'session_token': session_token, 'user': user})}

    return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}
