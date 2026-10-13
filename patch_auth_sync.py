import os
import re

dir_path = 'backend/src/controllers'

new_sync_code = r"""  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
  const { data: __don } = await supabase.from('donors').select('*');
  if (__don) db.donors = __don;
  const { data: __hosp } = await supabase.from('hospitals').select('*');
  if (__hosp) db.hospitals = __hosp;
  const { data: __bb } = await supabase.from('blood_banks').select('*');
  if (__bb) db.bloodBanks = __bb;
"""

old_sync_pattern = r"  // Sync with Supabase \(Minimal Migration\)\s+const { data: __bu } = await supabase\.from\('blood_units'\)\.select\('\*'\);\s+if \(__bu\) db\.bloodUnits = __bu;\s+const { data: __br } = await supabase\.from\('blood_requests'\)\.select\('\*'\);\s+if \(__br\) db\.bloodRequests = __br;"


for filename in os.listdir(dir_path):
    if not filename.endswith('.ts'): continue
    filepath = os.path.join(dir_path, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace old sync code
    content = re.sub(old_sync_pattern, new_sync_code, content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Auth tables appended to controller fetch sync.")
