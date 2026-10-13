import os
import re

dir_path = 'backend/src/controllers'

for filename in os.listdir(dir_path):
    if not filename.endswith('.ts'): continue
    filepath = os.path.join(dir_path, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # The exact string that was injected
    bad_str = "await supabase.from('blood_units').upsert(db.bloodUnits);\n  await supabase.from('blood_requests').upsert(db.bloodRequests);\n"
    content = content.replace(bad_str, "")

    # Also clean up the possible remaining bits
    bad_str2 = "\nawait supabase.from('blood_units').upsert(db.bloodUnits);\nawait supabase.from('blood_requests').upsert(db.bloodRequests);"
    content = content.replace(bad_str2, "")

    bad_str3 = "await supabase.from('blood_units').upsert(db.bloodUnits);\nawait supabase.from('blood_requests').upsert(db.bloodRequests);\n"
    content = content.replace(bad_str3, "")
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Fix 2 applied.")
