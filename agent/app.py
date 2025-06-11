from flask import Flask, jsonify, send_file
from livekit import api
import os
from flask_cors import CORS
import csv

app = Flask(__name__)
CORS(app)

@app.route('/token')
def get_token():
    api_key = os.getenv('LIVEKIT_API_KEY')
    api_secret = os.getenv('LIVEKIT_API_SECRET')
    livekit_url = os.getenv('LIVEKIT_URL')

    token = api.AccessToken(api_key, api_secret) \
        .with_identity("identity") \
        .with_name("name") \
        .with_grants(api.VideoGrants(
            room_join=True,
            room="my-room",
        )).to_jwt()

    return jsonify({
        'token': token,
        'livekit_url': livekit_url
    })

@app.route('/start-call')
def start_call():
    with open('metrics_log.csv', 'w') as f:
        f.truncate()  # Clear contents
    return jsonify({'message': 'metrics_log.csv cleared'})

@app.route('/end-call')
def end_call():
    data = []
    try:
        with open('metrics_log.csv', 'r') as f:
            reader = csv.reader(f)
            data = list(reader)  # includes header
    except FileNotFoundError:
        return jsonify({'error': 'metrics_log.csv not found'}), 404
    return jsonify({'metrics': data})


if __name__ == '__main__':
    app.run(debug=True)
