"""
Авторизация через Яндекс ID (OAuth 2.0).
POST /exchange — обменивает code на токен и возвращает данные пользователя + сессию.
GET /me — возвращает текущего пользователя по session_token.
"""
import json
import os
import uuid
import urllib.request
import urllib.parse
import psycopg2


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def yandex_token_exchange(code: str, redirect_uri: str) -> dict:
    client_id = os.environ['YANDEX_CLIENT_ID']
    client_secret = os.environ['YANDEX_CLIENT_SECRET']

    data = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'code': code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://oauth.yandex.ru/token',
        data=data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def yandex_get_user(access_token: str) -> dict:
    req = urllib.request.Request(
        'https://login.yandex.ru/info?format=json',
        headers={'Authorization': f'OAuth {access_token}'},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def upsert_user(conn, yandex_data: dict) -> dict:
    yandex_id = str(yandex_data.get('id', ''))
    email = yandex_data.get('default_email') or yandex_data.get('emails', [None])[0]
    name = yandex_data.get('real_name') or yandex_data.get('display_name') or ''
    avatar_id = yandex_data.get('default_avatar_id')
    avatar_url = f'https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200' if avatar_id else None

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO users (yandex_id, email, name, avatar_url, updated_at)
        VALUES (%s, %s, %s, %s, NOW())
        ON CONFLICT (yandex_id) DO UPDATE
          SET email = EXCLUDED.email,
              name = EXCLUDED.name,
              avatar_url = EXCLUDED.avatar_url,
              updated_at = NOW()
        RETURNING id, yandex_id, email, name, avatar_url, created_at
    """, (yandex_id, email, name, avatar_url))
    row = cur.fetchone()
    conn.commit()
    cur.close()
    return {'id': row[0], 'yandex_id': row[1], 'email': row[2], 'name': row[3], 'avatar_url': row[4]}


def create_session(conn, user_id: int) -> str:
    token = str(uuid.uuid4())
    cur = conn.cursor()
    # Простое хранение сессии в отдельной таблице (создаём если нет)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
          token VARCHAR(64) PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
        )
    """)
    cur.execute(
        "INSERT INTO sessions (token, user_id) VALUES (%s, %s)",
        (token, user_id)
    )
    conn.commit()
    cur.close()
    return token


def get_user_by_session(conn, token: str) -> dict | None:
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.yandex_id, u.email, u.name, u.avatar_url
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {'id': row[0], 'yandex_id': row[1], 'email': row[2], 'name': row[3], 'avatar_url': row[4]}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')

    # GET /me — проверка текущей сессии
    if method == 'GET' and '/me' in path:
        token = (event.get('headers') or {}).get('X-Session-Token', '')
        if not token:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Нет токена'})}
        conn = get_db()
        user = get_user_by_session(conn, token)
        conn.close()
        if not user:
            return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Сессия истекла'})}
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(user)}

    # POST /exchange — обмен code → сессия
    if method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

        code = body.get('code', '')
        redirect_uri = body.get('redirect_uri', '')
        if not code:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'code обязателен'})}

        token_data = yandex_token_exchange(code, redirect_uri)
        access_token = token_data.get('access_token')
        if not access_token:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Не удалось получить токен Яндекса'})}

        yandex_user = yandex_get_user(access_token)

        conn = get_db()
        user = upsert_user(conn, yandex_user)
        session_token = create_session(conn, user['id'])
        conn.close()

        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'session_token': session_token, 'user': user})
        }

    return {'statusCode': 404, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Not found'})}
