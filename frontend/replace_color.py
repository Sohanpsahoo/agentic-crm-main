import os

def replace_in_dir(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.jsx') or file.endswith('.js') or file.endswith('.css'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    changed = False
                    if '#FFFFFF' in content or '#ffffff' in content:
                        content = content.replace('#FFFFFF', '#020202').replace('#ffffff', '#020202')
                        changed = True
                        
                    if '#FFFAEC' in content or '#fffaec' in content:
                        content = content.replace('#FFFAEC', '#09090B').replace('#fffaec', '#09090B')
                        changed = True

                    if changed:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

if __name__ == '__main__':
    replace_in_dir(r'd:\Downloads\agentic-crm-main(1)\agentic-crm-main\frontend\src')
