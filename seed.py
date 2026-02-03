import sqlite3
import json
import os

DB_FILE = 'klassekart_ferdig.db'

def seed_db():
    # Slett gammel fil for å starte helt rent (valgfritt, men sikrer null krøll)
    if os.path.exists(DB_FILE):
        try:
            os.remove(DB_FILE)
            print(f"Slettet gammel database: {DB_FILE}")
        except:
            print("Kunne ikke slette filen, prøver å fortsette...")

    conn = sqlite3.connect(DB_FILE)
    
    print("Oppretter tabeller...")
    # 1. Opprett tabeller (Samme skjema som i app.py)
    conn.execute('''CREATE TABLE IF NOT EXISTS classes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS students 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                     class_id INTEGER, 
                     name TEXT, 
                     color TEXT DEFAULT 'default', 
                     note TEXT, 
                     FOREIGN KEY(class_id) REFERENCES classes(id))''')
    conn.execute('''CREATE TABLE IF NOT EXISTS classrooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, layout_data TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS seating_charts 
                    (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                     name TEXT, 
                     class_id INTEGER, 
                     room_id INTEGER, 
                     layout_snapshot TEXT, 
                     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)''')

    # 2. Tøm data (hvis filen ikke ble slettet)
    conn.execute("DELETE FROM seating_charts")
    conn.execute("DELETE FROM students")
    conn.execute("DELETE FROM classes")
    conn.execute("DELETE FROM classrooms")
    
    # 3. Opprett Klasser
    print("Seeder klasser...")
    classes = [("1ST1",), ("2ST3",), ("3PBY",)]
    cursor = conn.executemany("INSERT INTO classes (name) VALUES (?)", classes)
    
    # Hent IDer for å koble elever riktig
    c1_id = conn.execute("SELECT id FROM classes WHERE name='1ST1'").fetchone()[0]
    c2_id = conn.execute("SELECT id FROM classes WHERE name='2ST3'").fetchone()[0]

    # 4. Opprett Elever
    print("Seeder elever...")
    students_1st1 = [
        (c1_id, "Ola Nordmann"), (c1_id, "Kari Hansen"), (c1_id, "Per Olsen"),
        (c1_id, "Anne Li"), (c1_id, "Knut Ås"), (c1_id, "Jens B"),
        (c1_id, "Liv T"), (c1_id, "Tom R"), (c1_id, "Siv K"), (c1_id, "Gro M"),
        (c1_id, "Espen Askeladd"), (c1_id, "Pippi L"), (c1_id, "Harry P"), (c1_id, "Ronny W")
    ]
    conn.executemany("INSERT INTO students (class_id, name) VALUES (?, ?)", students_1st1)
    
    students_2st3 = [(c2_id, f"Elev {i}") for i in range(1, 20)]
    conn.executemany("INSERT INTO students (class_id, name) VALUES (?, ?)", students_2st3)

    # 5. Opprett Rom (Layout JSON)
    print("Seeder rom...")
    
    def create_grid(rows, cols):
        layout = []
        start_y = 60
        desk_w, desk_h = 80, 50
        gap = 0
        aisle = 40
        canvas_w = 900 # Antar standard bredde i editor
        
        # Sentrering
        total_row_w = (cols * desk_w) + ((cols // 2) * aisle) 
        start_x = max(20, (canvas_w - total_row_w) / 2)
        
        for r in range(rows):
            curr_x = start_x
            for c in range(cols):
                layout.append({"x": int(curr_x), "y": int(start_y)})
                curr_x += desk_w + gap
                if (c + 1) % 2 == 0: curr_x += aisle
            start_y += desk_h + 30
        return json.dumps(layout)

    r1_layout = create_grid(4, 4) # 16 plasser
    r2_layout = create_grid(5, 6) # 30 plasser
    
    conn.execute("INSERT INTO classrooms (name, layout_data) VALUES (?, ?)", ("Rom A204", r1_layout))
    conn.execute("INSERT INTO classrooms (name, layout_data) VALUES (?, ?)", ("Rom B101 (Stor)", r2_layout))
    
    # 6. Opprett et dummy klassekart
    print("Seeder klassekart...")
    room_id = conn.execute("SELECT id FROM classrooms WHERE name='Rom A204'").fetchone()[0]
    
    # Bygg snapshot
    snapshot = json.loads(r1_layout)
    # Putt inn de første 10 elevene manuelt i snapshotet
    for i, s_data in enumerate(students_1st1):
        if i < len(snapshot):
            # Merk: Her må vi matche strukturen til saveCurrentChart i JS
            # Vi trenger IDen til eleven vi nettopp la inn.
            # For enkelhets skyld henter vi den fra DB basert på navn og klasse
            s_name = s_data[1]
            s_obj = conn.execute("SELECT id, name, note FROM students WHERE name=? AND class_id=?", (s_name, c1_id)).fetchone()
            
            snapshot[i]['student'] = {'id': s_obj[0], 'name': s_obj[1], 'note': s_obj[2]}
            snapshot[i]['colorClass'] = 'bg-default' # Bruk riktig feltnavn fra JS (colorClass)
            snapshot[i]['groupId'] = 1 if i < 4 else None 
            snapshot[i]['locked'] = False

    conn.execute("INSERT INTO seating_charts (name, class_id, room_id, layout_snapshot) VALUES (?, ?, ?, ?)",
                 ("Uke 42 - Prosjekt", c1_id, room_id, json.dumps(snapshot)))

    conn.commit()
    conn.close()
    print("Ferdig! Databasen er klar.")

if __name__ == '__main__':
    seed_db()