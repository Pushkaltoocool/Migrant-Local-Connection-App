from flask import Flask, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Store active users and rooms
active_users = {}
rooms = {}

@app.route('/')
def index():
    return {'status': 'Chat server running'}

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')
    emit('connected', {'id': request.sid})

@socketio.on('disconnect')
def handle_disconnect():
    user_id = request.sid
    if user_id in active_users:
        username = active_users[user_id]['username']
        room = active_users[user_id].get('room')

        if room and room in rooms:
            rooms[room].remove(user_id)
            emit('user_left', {
                'username': username,
                'timestamp': datetime.now().isoformat()
            }, room=room)

        del active_users[user_id]
    print(f'Client disconnected: {user_id}')

@socketio.on('join')
def handle_join(data):
    username = data.get('username')
    room = data.get('room', 'general')

    active_users[request.sid] = {
        'username': username,
        'room': room
    }

    join_room(room)

    if room not in rooms:
        rooms[room] = []
    rooms[room].append(request.sid)

    emit('user_joined', {
        'username': username,
        'timestamp': datetime.now().isoformat()
    }, room=room)

    emit('join_success', {
        'room': room,
        'username': username
    })

@socketio.on('leave')
def handle_leave(data):
    room = data.get('room')
    if request.sid in active_users:
        username = active_users[request.sid]['username']
        leave_room(room)

        if room in rooms and request.sid in rooms[room]:
            rooms[room].remove(request.sid)

        emit('user_left', {
            'username': username,
            'timestamp': datetime.now().isoformat()
        }, room=room)

@socketio.on('message')
def handle_message(data):
    if request.sid not in active_users:
        return

    username = active_users[request.sid]['username']
    room = active_users[request.sid].get('room', 'general')
    message = data.get('message')

    message_data = {
        'id': f"{request.sid}_{datetime.now().timestamp()}",
        'username': username,
        'message': message,
        'timestamp': datetime.now().isoformat(),
        'room': room
    }

    emit('message', message_data, room=room)

@socketio.on('typing')
def handle_typing(data):
    if request.sid not in active_users:
        return

    username = active_users[request.sid]['username']
    room = active_users[request.sid].get('room', 'general')
    is_typing = data.get('typing', False)

    emit('typing', {
        'username': username,
        'typing': is_typing
    }, room=room, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=8080)
