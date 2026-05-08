"""
Генерация изображений через fal.ai (FLUX). Требует авторизации, списывает 1 единицу с баланса.
"""
import json
import os
import uuid
import urllib.request
import urllib.error
import psycopg2
import boto3


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Token',
}


def resp(status: int, data: dict) -> dict:
    return {'statusCode': status, 'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'}, 'body': json.dumps(data)}


def handler(event: dict, context) -> dict:
    """Генерация изображения по текстовому описанию. Требует session_token, списывает 1 единицу баланса."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return resp(400, {'error': 'Invalid JSON'})

    prompt = (body.get('prompt') or '').strip()
    if not prompt:
        return resp(400, {'error': 'prompt обязателен'})

    headers = event.get('headers') or {}
    session_token = headers.get('X-Session-Token') or headers.get('x-session-token') or body.get('session_token', '')
    if not session_token:
        return resp(401, {'error': 'Нужно войти в аккаунт'})

    model = body.get('model', 'fal-ai/flux/schnell')
    image_size = body.get('image_size', 'square_hd')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT u.id, u.balance FROM sessions s JOIN users u ON s.user_id = u.id
            WHERE s.token = %s AND s.expires_at > NOW()
        """, (session_token,))
        row = cur.fetchone()
        if not row:
            cur.close()
            return resp(401, {'error': 'Сессия истекла, войдите заново'})
        user_id, balance = row[0], row[1] or 0
        if balance < 1:
            cur.close()
            return resp(402, {'error': 'Недостаточно генераций. Активируйте промокод в профиле.'})
        # списываем заранее, чтобы избежать гонок
        cur.execute("UPDATE users SET balance = balance - 1 WHERE id = %s AND balance > 0 RETURNING balance", (user_id,))
        debited = cur.fetchone()
        if not debited:
            cur.close()
            return resp(402, {'error': 'Недостаточно генераций'})
        new_balance = debited[0]
        conn.commit()
        cur.close()
    except Exception as e:
        conn.close()
        return resp(500, {'error': f'DB error: {e}'})

    fal_key = os.environ.get('FAL_API_KEY', '')
    if not fal_key:
        # Возвращаем баланс
        try:
            cur = conn.cursor()
            cur.execute("UPDATE users SET balance = balance + 1 WHERE id = %s", (user_id,))
            conn.commit()
            cur.close()
        finally:
            conn.close()
        return resp(500, {'error': 'FAL_API_KEY не настроен'})

    fal_payload = json.dumps({
        'prompt': prompt,
        'image_size': image_size,
        'num_images': 1,
        'enable_safety_checker': True,
    }).encode('utf-8')

    req = urllib.request.Request(
        f'https://fal.run/{model}',
        data=fal_payload,
        headers={'Authorization': f'Key {fal_key}', 'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            fal_result = json.loads(r.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        # возврат баланса
        try:
            cur = conn.cursor()
            cur.execute("UPDATE users SET balance = balance + 1 WHERE id = %s RETURNING balance", (user_id,))
            new_balance = cur.fetchone()[0]
            conn.commit()
            cur.close()
        finally:
            pass
        conn.close()
        return resp(502, {'error': f'fal.ai error: {err_body}', 'balance': new_balance})

    images = fal_result.get('images') or []
    if not images:
        try:
            cur = conn.cursor()
            cur.execute("UPDATE users SET balance = balance + 1 WHERE id = %s RETURNING balance", (user_id,))
            new_balance = cur.fetchone()[0]
            conn.commit()
            cur.close()
        finally:
            pass
        conn.close()
        return resp(502, {'error': 'fal.ai не вернул изображение', 'balance': new_balance})

    fal_image_url = images[0].get('url', '')
    s3_url = fal_image_url
    try:
        with urllib.request.urlopen(fal_image_url, timeout=30) as img_resp:
            img_data = img_resp.read()
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        key = f'generations/{uuid.uuid4()}.jpg'
        s3.put_object(Bucket='files', Key=key, Body=img_data, ContentType='image/jpeg')
        s3_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    except Exception:
        pass

    gen_id = None
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO generations (user_id, prompt, model, status, image_url) VALUES (%s, %s, %s, 'done', %s) RETURNING id",
            (user_id, prompt, model, s3_url)
        )
        gen_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
    except Exception:
        pass
    finally:
        conn.close()

    return resp(200, {
        'id': gen_id,
        'image_url': s3_url,
        'prompt': prompt,
        'model': model,
        'balance': new_balance,
    })
