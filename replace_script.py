import re

with open('d:/Downloads/agentic-crm-main(1)/agentic-crm-main/index(5).html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change title and description
content = re.sub(
    r'<title>Xeno \|.*?</title>',
    '<title>Agentic CRM | AI-Powered Customer Relationship Management</title>',
    content
)

content = re.sub(
    r'content="Xeno is a cutting-edge[^"]*"',
    'content="Agentic CRM is an AI-powered CRM that leverages autonomous AI agents to orchestrate marketing campaigns, segment audiences, and provide deep analytics insights."',
    content
)

# 2. Change name (Xeno -> Agentic CRM)
content = re.sub(r'>Xeno<', '>Agentic CRM<', content)
content = re.sub(r'Xeno ', 'Agentic CRM ', content)
content = re.sub(r' Xeno', ' Agentic CRM', content)
content = re.sub(r'>XENO<', '>AGENTIC CRM<', content)
content = re.sub(r'XENO ', 'AGENTIC CRM ', content)
content = re.sub(r' XENO', ' AGENTIC CRM', content)
content = re.sub(r"Xeno's", "Agentic CRM's", content)
content = re.sub(r'Xeno&#x27;s', 'Agentic CRM&#x27;s', content)

# 3. Change Logo
content = re.sub(
    r'<img[^>]*newlogoxeno-blue11\.png[^>]*>',
    '<img src="https://dummyimage.com/150x50/0f62fe/ffffff.png?text=Agentic+CRM" alt="Agentic CRM" class="xeno-logo" style="max-width: 150px;" />',
    content
)

# 4. Change continue button
content = content.replace('>Get A Demo<', '>Continue<')
content = content.replace('>Book A Demo<', '>Continue<')
content = content.replace('>See Agentic CRM in Action!<', '>Continue<')

with open('d:/Downloads/agentic-crm-main(1)/agentic-crm-main/index(5).html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
