"""
Админ-панель: создание промокодов, список промокодов, статистика. Доступ только для is_admin = TRUE.
"""
import json
import os
import secrets as py_secrets
import string
import psycopg2


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
}


def db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def resp(status: int, data: dict) -> dict:
    return {'statusCode': status, 'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'}, 'body': json.dumps(data, default=str)}


def get_admin(conn, token: str):
    cur = conn.cursor()
    cur.execute("""
        SELECT u.id, u.email, u.is_admin
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token = %s AND s.expires_at > NOW()
    """, (token,))
    row = cur.fetchone()
    cur.close()
    if not row or not row[2]:
        return None
    return {'id': row[0], 'email': row[1]}


def gen_code(length: int = 12) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(py_secrets.choice(alphabet) for _ in range(length))


def handler(event: dict, context) -> dict:
    """Админ-панель промокодов: create-promo, list-promo, stats. Требует токен админа."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return resp(400, {'error': 'Invalid JSON'})

    headers = event.get('headers') or {}
    token = headers.get('X-Session-Token') or headers.get('x-session-token') or body.get('session_token', '')
    if not token:
        return resp(401, {'error': 'Нет токена'})

    conn = db()
    try:
        admin = get_admin(conn, token)
        if not admin:
            return resp(403, {'error': 'Доступ только для администратора'})

        action = body.get('action', '')

        if action == 'create-promo':
            try:
                amount = int(body.get('amount') or 0)
            except Exception:
                amount = 0
            if amount <= 0 or amount > 100000:
                return resp(400, {'error': 'Сумма должна быть от 1 до 100000'})
            count = max(1, min(int(body.get('count') or 1), 100))
            comment = (body.get('comment') or '').strip()[:500] or None

            created = []
            cur = conn.cursor()
            for _ in range(count):
                # пробуем 5 раз на случай коллизии
                for _attempt in range(5):
                    c = gen_code()
                    try:
                        cur.execute(
                            "INSERT INTO promo_codes (code, amount, created_by, comment) VALUES (%s, %s, %s, %s) RETURNING id, code, amount, created_at",
                            (c, amount, admin['id'], comment)
                        )
                        r = cur.fetchone()
                        created.append({'id': r[0], 'code': r[1], 'amount': r[2], 'created_at': r[3]})
                        break
                    except psycopg2.errors.UniqueViolation:
                        conn.rollback()
                        continue
            conn.commit()
            cur.close()
            return resp(200, {'created': created})

        if action == 'list-promo':
            cur = conn.cursor()
            cur.execute("""
                SELECT p.id, p.code, p.amount, p.created_at, p.used_at, p.comment,
                       u.email AS used_by_email
                FROM promo_codes p
                LEFT JOIN users u ON p.used_by = u.id
                ORDER BY p.created_at DESC
                LIMIT 200
            """)
            rows = cur.fetchall()
            cur.close()
            items = [{
                'id': r[0], 'code': r[1], 'amount': r[2],
                'created_at': r[3], 'used_at': r[4], 'comment': r[5],
                'used_by_email': r[6],
            } for r in rows]
            return resp(200, {'items': items})

        if action == 'stats':
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM users")
            users_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM promo_codes")
            promo_total = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM promo_codes WHERE used_by IS NOT NULL")
            promo_used = cur.fetchone()[0]
            cur.execute("SELECT COALESCE(SUM(amount),0) FROM promo_codes WHERE used_by IS NOT NULL")
            promo_redeemed_amount = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM generations")
            gen_count = cur.fetchone()[0]
            cur.close()
            return resp(200, {
                'users': users_count,
                'promo_total': promo_total,
                'promo_used': promo_used,
                'promo_redeemed_amount': promo_redeemed_amount,
                'generations': gen_count,
            })

        return resp(400, {'error': f'Неизвестный action: {action}'})
    finally:
        conn.close()
