import sqlite3
import glob
import os

base_dir = r"C:\Users\91637\AppData\Roaming\@leadforge\desktop"
db_files = glob.glob(os.path.join(base_dir, "**", "*.db"), recursive=True)

print(f"Found {len(db_files)} DB files under {base_dir}:")
for p in db_files:
    size = os.path.getsize(p)
    print(f"\n==================================================")
    print(f"DB Path: {p}")
    print(f"Size: {size} bytes")
    try:
        con = sqlite3.connect(p)
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        print(f"Tables ({len(tables)}): {tables}")
        for t in tables:
            try:
                cur.execute(f"SELECT count(*) FROM `{t}`")
                cnt = cur.fetchone()[0]
                cur.execute(f"PRAGMA table_info(`{t}`)")
                cols = [c[1] for c in cur.fetchall()]
                print(f"  - {t} ({cnt} rows): {cols}")
                if t == 'cache_metadata':
                    cur.execute(f"SELECT * FROM `{t}`")
                    print(f"      Rows in {t}: {cur.fetchall()}")
            except Exception as ex:
                print(f"  - {t} (error querying): {ex}")
        con.close()
    except Exception as e:
        print(f"Error opening DB: {e}")
