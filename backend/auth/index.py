"""
Авторизация: регистрация по email+паролю, вход с опциональным TOTP, привязка/отвязка TOTP, получение профиля.
Все запросы — POST с JSON body, action определяет операцию.
"""
import json
import os
import hmac
import hashlib
import base64
import secrets as py_secrets
import struct
import time
import uuid
import psycopg2


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = py_secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return base64.b64encode(salt).decode() + '$' + base64.b64encode(dk).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_b64, dk_b64 = stored.split('$')
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(dk_b64)
        actual = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def gen_totp_secret() -> str:
    raw = py_secrets.token_bytes(20)
    return base64.b32encode(raw).decode().rstrip('=')


def totp_code(secret_b32: str, t: int = None) -> str:
    if t is None:
        t = int(time.time())
    secret = base64.b32decode(secret_b32 + '=' * ((8 - len(secret_b32) % 8) % 8))
    counter = struct.pack('>Q', t // 30)
    h = hmac.new(secret, counter, hashlib.sha1).digest()
    o = h[-1] & 0x0F
    code = (struct.unpack('>I', h[o:o+4])[0] & 0x7FFFFFFF) % 1_000_000
    return f'{code:06d}'


def verify_totp(secret_b32: str, code: str) -> bool:
    if not code or not code.isdigit() or len(code) != 6:
        return False
    now = int(time.time())
    for delta in (-1, 0, 1):
        if hmac.compare_digest(totp_code(secret_b32, now + delta * 30), code):
            return True
    return False


def create_session(conn, user_id: int) -> str:
    token = str(uuid.uuid4())
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (token, user_id) VALUES (%s, %s)", (token, user_id))
    conn.commit()
    cur.close()
    return token


def user_to_dict(row) -> dict:
    return {
        'id': row[0],
        'email': row[1],
        'name': row[2] or '',
        'avatar_url': row[3],
        'balance': row[4] or 0,
        'is_admin': bool(row[5]),
        'totp_enabled': bool(row[6]),
    }


def get_user_by_session(conn, token: str):
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, u.name, u.avatar_url, u.balance, u.is_admin, u.totp_enabled
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    cur.close()
    return user_to_dict(row) if row else None


def resp(status: int, data: dict) -> dict:
    return {'statusCode': status, 'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'}, 'body': json.dumps(data)}


def handler(event: dict, context) -> dict:
    """Авторизация: register, login, login-2fa, me, totp-setup, totp-enable, totp-disable, change-password"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return resp(400, {'error': 'Invalid JSON'})

    action = body.get('action', '')
    headers = event.get('headers') or {}
    session_token = headers.get('X-Session-Token') or headers.get('x-session-token') or body.get('session_token', '')

    conn = db()
    try:
        if action == 'register':
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            if not email or '@' not in email or len(password) < 6:
                return resp(400, {'error': 'Email и пароль (мин. 6 символов) обязательны'})
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE LOWER(email) = %s", (email,))
            if cur.fetchone():
                cur.close()
                return resp(400, {'error': 'Пользователь с таким email уже существует'})
            ph = hash_password(password)
            is_admin = email == 'zenaturin27@gmail.com'
            cur.execute("""
                INSERT INTO users (yandex_id, email, name, email_verified, password_hash, balance, is_admin)
                VALUES (%s, %s, %s, TRUE, %s, 0, %s)
                RETURNING id, email, name, avatar_url, balance, is_admin, totp_enabled
            """, (f'pwd:{email}', email, email.split('@')[0], ph, is_admin))
            user = user_to_dict(cur.fetchone())
            conn.commit()
            cur.close()
            token = create_session(conn, user['id'])
            return resp(200, {'session_token': token, 'user': user})

        if action == 'login':
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            cur = conn.cursor()
            cur.execute("""
                SELECT id, email, name, avatar_url, balance, is_admin, totp_enabled, password_hash
                FROM users WHERE LOWER(email) = %s
            """, (email,))
            row = cur.fetchone()
            cur.close()
            if not row or not row[7] or not verify_password(password, row[7]):
                return resp(401, {'error': 'Неверный email или пароль'})
            user = user_to_dict(row[:7])
            if user['totp_enabled']:
                # требуется второй фактор — выдаём временный pending-токен
                pending = py_secrets.token_urlsafe(24)
                cur = conn.cursor()
                cur.execute("INSERT INTO magic_links (email, token) VALUES (%s, %s)", (f'2fa:{user["id"]}', pending))
                conn.commit()
                cur.close()
                return resp(200, {'requires_2fa': True, 'pending_token': pending})
            token = create_session(conn, user['id'])
            return resp(200, {'session_token': token, 'user': user})

        if action == 'login-2fa':
            pending = (body.get('pending_token') or '').strip()
            code = (body.get('code') or '').strip()
            cur = conn.cursor()
            cur.execute("""
                SELECT email FROM magic_links
                WHERE token = %s AND used = FALSE AND expires_at > NOW()
            """, (pending,))
            row = cur.fetchone()
            if not row or not row[0].startswith('2fa:'):
                cur.close()
                return resp(400, {'error': 'Сессия 2FA истекла, войдите заново'})
            user_id = int(row[0].split(':', 1)[1])
            cur.execute("UPDATE magic_links SET used = TRUE WHERE token = %s", (pending,))
            cur.execute("""
                SELECT id, email, name, avatar_url, balance, is_admin, totp_enabled, totp_secret
                FROM users WHERE id = %s
            """, (user_id,))
            urow = cur.fetchone()
            cur.close()
            conn.commit()
            if not urow or not urow[7] or not verify_totp(urow[7], code):
                return resp(401, {'error': 'Неверный код из приложения'})
            user = user_to_dict(urow[:7])
            token = create_session(conn, user['id'])
            return resp(200, {'session_token': token, 'user': user})

        if action == 'me':
            if not session_token:
                return resp(401, {'error': 'Нет токена'})
            user = get_user_by_session(conn, session_token)
            if not user:
                return resp(401, {'error': 'Сессия истекла'})
            return resp(200, user)

        # Все действия ниже требуют авторизации
        if not session_token:
            return resp(401, {'error': 'Нет токена'})
        current = get_user_by_session(conn, session_token)
        if not current:
            return resp(401, {'error': 'Сессия истекла'})

        if action == 'totp-setup':
            secret = gen_totp_secret()
            cur = conn.cursor()
            cur.execute("UPDATE users SET totp_secret = %s WHERE id = %s", (secret, current['id']))
            conn.commit()
            cur.close()
            issuer = 'LUMIX AI'
            label = current['email'] or f"user{current['id']}"
            otpauth = f"otpauth://totp/{issuer}:{label}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"
            return resp(200, {'secret': secret, 'otpauth_url': otpauth})

        if action == 'totp-enable':
            code = (body.get('code') or '').strip()
            cur = conn.cursor()
            cur.execute("SELECT totp_secret FROM users WHERE id = %s", (current['id'],))
            row = cur.fetchone()
            if not row or not row[0]:
                cur.close()
                return resp(400, {'error': 'Сначала выполните totp-setup'})
            if not verify_totp(row[0], code):
                cur.close()
                return resp(400, {'error': 'Неверный код'})
            cur.execute("UPDATE users SET totp_enabled = TRUE WHERE id = %s", (current['id'],))
            conn.commit()
            cur.close()
            return resp(200, {'ok': True})

        if action == 'totp-disable':
            password = body.get('password') or ''
            cur = conn.cursor()
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (current['id'],))
            row = cur.fetchone()
            if not row or not verify_password(password, row[0] or ''):
                cur.close()
                return resp(401, {'error': 'Неверный пароль'})
            cur.execute("UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = %s", (current['id'],))
            conn.commit()
            cur.close()
            return resp(200, {'ok': True})

        if action == 'redeem-promo':
            code = (body.get('code') or '').strip().upper()
            if not code:
                return resp(400, {'error': 'Код обязателен'})
            cur = conn.cursor()
            cur.execute("SELECT id, amount, used_by FROM promo_codes WHERE code = %s", (code,))
            row = cur.fetchone()
            if not row:
                cur.close()
                return resp(404, {'error': 'Код не найден'})
            if row[2] is not None:
                cur.close()
                return resp(400, {'error': 'Этот код уже использован'})
            cur.execute("UPDATE promo_codes SET used_by = %s, used_at = NOW() WHERE id = %s", (current['id'], row[0]))
            cur.execute("UPDATE users SET balance = COALESCE(balance,0) + %s WHERE id = %s RETURNING balance", (row[1], current['id']))
            new_balance = cur.fetchone()[0]
            conn.commit()
            cur.close()
            return resp(200, {'ok': True, 'amount': row[1], 'balance': new_balance})

        if action == 'logout':
            cur = conn.cursor()
            cur.execute("DELETE FROM sessions WHERE token = %s", (session_token,))
            conn.commit()
            cur.close()
            return resp(200, {'ok': True})

        return resp(400, {'error': f'Неизвестный action: {action}'})
    finally:
        conn.close()
