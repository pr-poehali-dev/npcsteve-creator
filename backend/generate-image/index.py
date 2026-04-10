"""
Генерация изображений по текстовому описанию через fal.ai (FLUX модель).
Сохраняет результат в S3 и историю в БД.
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
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Invalid JSON'})}

    prompt = (body.get('prompt') or '').strip()
    if not prompt:
        return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'prompt обязателен'})}

    user_id = body.get('user_id')
    model = body.get('model', 'fal-ai/flux/schnell')
    image_size = body.get('image_size', 'square_hd')

    fal_key = os.environ.get('FAL_API_KEY', '')
    if not fal_key:
        return {'statusCode': 500, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'FAL_API_KEY не настроен'})}

    # Вызов fal.ai API
    fal_payload = json.dumps({
        'prompt': prompt,
        'image_size': image_size,
        'num_images': 1,
        'enable_safety_checker': True,
    }).encode('utf-8')

    req = urllib.request.Request(
        f'https://fal.run/{model}',
        data=fal_payload,
        headers={
            'Authorization': f'Key {fal_key}',
            'Content-Type': 'application/json',
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            fal_result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        return {'statusCode': 502, 'headers': CORS_HEADERS, 'body': json.dumps({'error': f'fal.ai error: {err_body}'})}

    images = fal_result.get('images') or []
    if not images:
        return {'statusCode': 502, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'fal.ai не вернул изображение'})}

    fal_image_url = images[0].get('url', '')

    # Скачиваем изображение и кладём в S3
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

    # Сохраняем в БД
    gen_id = None
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO generations (user_id, prompt, model, status, image_url) VALUES (%s, %s, %s, 'done', %s) RETURNING id",
            (user_id, prompt, model, s3_url)
        )
        gen_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass

    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'id': gen_id,
            'image_url': s3_url,
            'prompt': prompt,
            'model': model,
        })
    }
