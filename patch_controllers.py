import os
import re

dir_path = 'backend/src/controllers'

for filename in os.listdir(dir_path):
    if not filename.endswith('.ts'): continue
    filepath = os.path.join(dir_path, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Make handlers async
    content = re.sub(r'export const (\w+) = \((req.*?\)) => \{', r'export const \1 = async (\2 => {', content)
    
    # 2. Add supabase import
    if "import { supabase }" not in content:
        content = "import { supabase } from '../models/db';\n" + content

    # 3. Add data fetch at the beginning of each handler if it's using db
    # We will identify the start of the handler block
    handler_start_pattern = r'(export const \w+ = async \(.*?\) => \{\n)'
    
    sync_code = """
  // Sync with Supabase (Minimal Migration)
  const { data: __bu } = await supabase.from('blood_units').select('*');
  if (__bu) db.bloodUnits = __bu;
  const { data: __br } = await supabase.from('blood_requests').select('*');
  if (__br) db.bloodRequests = __br;
"""
    
    content = re.sub(handler_start_pattern, r'\1' + sync_code, content)

    # 4. For responses (res.json, res.status), if there were mutations, we sync back to supabase
    # A simple approach: before ANY `res.json` or `res.status(...).json`, we sync the whole array to supabase!
    # "minimal changes" - this is extremely minimal and ensures Supabase is the source of truth.
    sync_write_code = """
  await supabase.from('blood_units').upsert(db.bloodUnits);
  await supabase.from('blood_requests').upsert(db.bloodRequests);
  """
    
    # We replace `res.json(` and `res.status(`
    # But wait, doing this before every return might be tricky. Let's just patch the explicit returns.
    content = re.sub(r'(\s+)(return\s+)?res\.json\(', r'\1' + sync_write_code.strip() + r'\n\1\2res.json(', content)
    content = re.sub(r'(\s+)(return\s+)?res\.status\(', r'\1' + sync_write_code.strip() + r'\n\1\2res.status(', content)
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Patch applied to all controllers.")

