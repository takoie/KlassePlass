import sqlite3
import json
import random
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_FILE = 'klassekart_ferdig.db'

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute('''CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)''')
    try: conn.execute('''ALTER TABLE students ADD COLUMN note TEXT''') 
    except: pass 
    conn.execute('''CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER, name TEXT, color TEXT DEFAULT 'default', note TEXT, FOREIGN KEY(class_id) REFERENCES classes(id))''')
    conn.execute('''CREATE TABLE IF NOT EXISTS classrooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, layout_data TEXT)''')
    
    # OPPDATERT: Legg til 'comment'
    try: conn.execute('''ALTER TABLE seating_charts ADD COLUMN comment TEXT''')
    except: pass
    
    conn.execute('''CREATE TABLE IF NOT EXISTS seating_charts 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                     name TEXT, 
                     comment TEXT,
                     class_id INTEGER, 
                     room_id INTEGER, 
                     layout_snapshot TEXT, 
                     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')
    conn.commit()
    conn.close()

init_db()

# --- KLASSER ---
@app.route('/api/classes', methods=['GET', 'POST'])
def handle_classes():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        cursor = conn.execute("INSERT INTO classes (name) VALUES (?)", (data.get('name'),))
        class_id = cursor.lastrowid
        if 'students' in data and data['students']:
            for student_name in data['students']:
                if student_name.strip():
                    conn.execute("INSERT INTO students (class_id, name) VALUES (?, ?)", (class_id, student_name.strip()))
        conn.commit()
        conn.close()
        return jsonify({"status": "created", "id": class_id})
    classes = conn.execute('''SELECT c.id, c.name, COUNT(s.id) as student_count FROM classes c LEFT JOIN students s ON c.id = s.class_id GROUP BY c.id ORDER BY c.name''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in classes])

@app.route('/api/classes/<int:class_id>', methods=['GET', 'PUT', 'DELETE'])
def single_class(class_id):
    conn = get_db_connection()
    if request.method == 'DELETE':
        conn.execute("DELETE FROM students WHERE class_id = ?", (class_id,))
        conn.execute("DELETE FROM classes WHERE id = ?", (class_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "deleted"})
    if request.method == 'PUT':
        data = request.json
        conn.execute("UPDATE classes SET name = ? WHERE id = ?", (data['name'], class_id))
        conn.execute("DELETE FROM students WHERE class_id = ?", (class_id,))
        for name in data['students']:
            if name.strip():
                conn.execute("INSERT INTO students (class_id, name) VALUES (?, ?)", (class_id, name.strip()))
        conn.commit()
        conn.close()
        return jsonify({"status": "updated"})
    cls = conn.execute("SELECT * FROM classes WHERE id = ?", (class_id,)).fetchone()
    students = conn.execute("SELECT * FROM students WHERE class_id = ?", (class_id,)).fetchall()
    conn.close()
    return jsonify({"id": cls['id'], "name": cls['name'], "students": [dict(s) for s in students]})

@app.route('/api/students/<int:student_id>', methods=['PUT'])
def update_student(student_id):
    conn = get_db_connection()
    data = request.json
    if 'note' in data: 
        conn.execute("UPDATE students SET note = ? WHERE id = ?", (data['note'], student_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "updated"})

# --- ROM ---
@app.route('/api/rooms', methods=['GET', 'POST'])
def handle_rooms():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        layout = json.dumps(data.get('layout', []))
        cursor = conn.execute("INSERT INTO classrooms (name, layout_data) VALUES (?, ?)", (data.get('name'), layout))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"status": "created", "id": new_id})
    rooms = conn.execute("SELECT * FROM classrooms ORDER BY name").fetchall()
    result = []
    for r in rooms:
        layout = json.loads(r['layout_data']) if r['layout_data'] else []
        result.append({"id": r['id'], "name": r['name'], "desk_count": len(layout)})
    conn.close()
    return jsonify(result)

@app.route('/api/rooms/<int:room_id>', methods=['GET', 'PUT', 'DELETE'])
def single_room(room_id):
    conn = get_db_connection()
    if request.method == 'DELETE':
        conn.execute("DELETE FROM classrooms WHERE id = ?", (room_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "deleted"})
    if request.method == 'PUT':
        data = request.json
        layout = json.dumps(data.get('layout', []))
        # REPLACE layout strictly
        conn.execute("UPDATE classrooms SET name = ?, layout_data = ? WHERE id = ?", (data['name'], layout, room_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "updated"})
    room = conn.execute("SELECT * FROM classrooms WHERE id = ?", (room_id,)).fetchone()
    conn.close()
    return jsonify({"id": room['id'], "name": room['name'], "layout": json.loads(room['layout_data']) if room['layout_data'] else []})

# --- KLASSEKART (CHARTS) ---
@app.route('/api/charts', methods=['GET', 'POST'])
def handle_charts():
    conn = get_db_connection()
    if request.method == 'POST':
        data = request.json
        layout_snapshot = json.dumps(data['layout'])
        comment = data.get('comment', '')
        cursor = conn.execute("INSERT INTO seating_charts (name, comment, class_id, room_id, layout_snapshot) VALUES (?, ?, ?, ?, ?)",
                     (data['name'], comment, data['class_id'], data['room_id'], layout_snapshot))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"status": "saved", "id": new_id})
    
    charts = conn.execute('''
        SELECT sc.id, sc.name, sc.comment, sc.created_at, c.name as class_name, r.name as room_name 
        FROM seating_charts sc
        LEFT JOIN classes c ON sc.class_id = c.id
        LEFT JOIN classrooms r ON sc.room_id = r.id
        ORDER BY sc.created_at DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(row) for row in charts])

@app.route('/api/charts/<int:chart_id>', methods=['GET', 'PUT', 'DELETE'])
def single_chart(chart_id):
    conn = get_db_connection()
    if request.method == 'DELETE':
        conn.execute("DELETE FROM seating_charts WHERE id = ?", (chart_id,))
        conn.commit()
        conn.close()
        return jsonify({"status": "deleted"})
    
    if request.method == 'PUT':
        data = request.json
        layout_snapshot = json.dumps(data['layout'])
        comment = data.get('comment', '')
        conn.execute("UPDATE seating_charts SET name = ?, comment = ?, layout_snapshot = ? WHERE id = ?", 
                     (data['name'], comment, layout_snapshot, chart_id))
        conn.commit()
        conn.close()
        return jsonify({"status": "updated"})

    chart = conn.execute("SELECT * FROM seating_charts WHERE id = ?", (chart_id,)).fetchone()
    conn.close()
    if chart:
        return jsonify({
            "id": chart['id'],
            "name": chart['name'],
            "comment": chart['comment'],
            "class_id": chart['class_id'],
            "room_id": chart['room_id'],
            "layout": json.loads(chart['layout_snapshot']) if chart['layout_snapshot'] else []
        })
    return jsonify({"error": "Not found"}), 404

if __name__ == '__main__':
    app.run(port=5000)