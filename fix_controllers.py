import os
import re

dir_path = 'backend/src/controllers'

sync_write_code = r"""  await supabase.from\('blood_units'\).upsert\(db.bloodUnits\);
  await supabase.from\('blood_requests'\).upsert\(db.bloodRequests\);
"""

for filename in os.listdir(dir_path):
    if not filename.endswith('.ts'): continue
    filepath = os.path.join(dir_path, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove the broken sync_write_code injections
    content = re.sub(sync_write_code, '', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Fix applied to all controllers.")
