#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
from pathlib import Path

def create_html_documentation():
    """Создает HTML файл с полной документацией"""
    
    # Проверяем наличие всех файлов
    files_to_check = [
        'README.md',
        'проект.md', 
        'Аутентификация и Identity.md',
        'Авторизация на основе прав.md',
        'маппинг статусов.md',
        'Seed Data (Наполнение базы при старте).md',
        'architecture-diagram.html'
    ]
    
    print('🔍 Проверка файлов...')
    for file in files_to_check:
        if os.path.exists(file):
            print(f'✅ {file}')
        else:
            print(f'❌ {file} - отсутствует')
    
    # Создаем HTML для PDF
    html_content = """<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Multi-Tenant SaaS Order Management System - Полная документация</title>
    <style>
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            line-height: 1.6; 
            margin: 40px; 
            color: #333;
        }
        h1 { color: #667eea; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
        h2 { color: #764ba2; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
        h3 { color: #555; }
        .page-break { page-break-before: always; }
        .toc { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
        .toc ul { list-style-type: none; }
        .toc a { text-decoration: none; color: #667eea; }
        .toc a:hover { text-decoration: underline; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .diagram-placeholder { 
            background: #e8f5e8; 
            border: 2px dashed #66cc66; 
            padding: 20px; 
            text-align: center; 
            margin: 20px 0;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <h1>🏗️ Multi-Tenant SaaS Order Management System</h1>
    <p><strong>Полная архитектурная документация</strong></p>
    
    <div class="toc">
        <h2>📋 Содержание</h2>
        <ul>
            <li><a href="#readme">1. README.md - Общая информация</a></li>
            <li><a href="#project">2. проект.md - Детальная архитектура</a></li>
            <li><a href="#auth">3. Аутентификация и Identity</a></li>
            <li><a href="#authorization">4. Авторизация на основе прав</a></li>
            <li><a href="#mapping">5. Маппинг статусов</a></li>
            <li><a href="#seed">6. Seed Data (Наполнение базы)</a></li>
            <li><a href="#architecture">7. Архитектурная диаграмма</a></li>
        </ul>
    </div>
    
    <div id="readme" class="page-break">
        <h1>1. README.md - Общая информация</h1>
"""
    
    # Добавляем содержимое README.md
    try:
        with open('README.md', 'r', encoding='utf-8') as f:
            readme_content = f.read()
            # Конвертируем Markdown в базовый HTML
            readme_html = readme_content.replace('#', '<h2>').replace('\n#', '\n<h2>')
            readme_html = readme_html.replace('**', '<strong>').replace('**', '</strong>')
            readme_html = readme_html.replace('*', '<em>').replace('*', '</em>')
            readme_html = readme_html.replace('\n\n', '</p><p>').replace('\n', '<br>')
            readme_html = '<p>' + readme_html + '</p>'
            html_content += f'<div>{readme_html}</div>'
    except Exception as e:
        print(f'Ошибка чтения README.md: {e}')
        html_content += '<p>❌ Ошибка загрузки README.md</p>'
    
    html_content += '</div><div id="project" class="page-break"><h1>2. проект.md - Детальная архитектура</h1>'
    
    # Добавляем содержимое проект.md
    try:
        with open('проект.md', 'r', encoding='utf-8') as f:
            project_content = f.read()
            project_html = project_content.replace('#', '<h2>').replace('\n#', '\n<h2>')
            project_html = project_html.replace('**', '<strong>').replace('**', '</strong>')
            project_html = project_html.replace('*', '<em>').replace('*', '</em>')
            project_html = project_html.replace('\n\n', '</p><p>').replace('\n', '<br>')
            project_html = '<p>' + project_html + '</p>'
            html_content += f'<div>{project_html}</div>'
    except Exception as e:
        print(f'Ошибка чтения проект.md: {e}')
        html_content += '<p>❌ Ошибка загрузки проект.md</p>'
    
    html_content += '</div><div id="auth" class="page-break"><h1>3. Аутентификация и Identity</h1>'
    
    # Добавляем содержимое Аутентификация и Identity.md
    try:
        with open('Аутентификация и Identity.md', 'r', encoding='utf-8') as f:
            auth_content = f.read()
            auth_html = auth_content.replace('#', '<h2>').replace('\n#', '\n<h2>')
            auth_html = auth_html.replace('**', '<strong>').replace('**', '</strong>')
            auth_html = auth_html.replace('*', '<em>').replace('*', '</em>')
            auth_html = auth_html.replace('\n\n', '</p><p>').replace('\n', '<br>')
            auth_html = '<p>' + auth_html + '</p>'
            html_content += f'<div>{auth_html}</div>'
    except Exception as e:
        print(f'Ошибка чтения Аутентификация и Identity.md: {e}')
        html_content += '<p>❌ Ошибка загрузки Аутентификация и Identity.md</p>'
    
    html_content += '</div><div id="authorization" class="page-break"><h1>4. Авторизация на основе прав</h1>'
    
    # Добавляем содержимое Авторизация на основе прав.md
    try:
        with open('Авторизация на основе прав.md', 'r', encoding='utf-8') as f:
            auth_rights_content = f.read()
            auth_rights_html = auth_rights_content.replace('#', '<h2>').replace('\n#', '\n<h2>')
            auth_rights_html = auth_rights_html.replace('**', '<strong>').replace('**', '</strong>')
            auth_rights_html = auth_rights_html.replace('*', '<em>').replace('*', '</em>')
            auth_rights_html = auth_rights_html.replace('\n\n', '</p><p>').replace('\n', '<br>')
            auth_rights_html = '<p>' + auth_rights_html + '</p>'
            html_content += f'<div>{auth_rights_html}</div>'
    except Exception as e:
        print(f'Ошибка чтения Авторизация на основе прав.md: {e}')
        html_content += '<p>❌ Ошибка загрузки Авторизация на основе прав.md</p>'
    
    html_content += '</div><div id="mapping" class="page-break"><h1>5. Маппинг статусов</h1>'
    
    # Добавляем содержимое маппинг статусов.md
    try:
        with open('маппинг статусов.md', 'r', encoding='utf-8') as f:
            mapping_content = f.read()
            mapping_html = mapping_content.replace('#', '<h2>').replace('\n#', '\n<h2>')
            mapping_html = mapping_html.replace('**', '<strong>').replace('**', '</strong>')
            mapping_html = mapping_html.replace('*', '<em>').replace('*', '</em>')
            mapping_html = mapping_html.replace('\n\n', '</p><p>').replace('\n', '<br>')
            mapping_html = '<p>' + mapping_html + '</p>'
            html_content += f'<div>{mapping_html}</div>'
    except Exception as e:
        print(f'Ошибка чтения маппинг статусов.md: {e}')
        html_content += '<p>❌ Ошибка загрузки маппинг статусов.md</p>'
    
    html_content += '</div><div id="seed" class="page-break"><h1>6. Seed Data (Наполнение базы)</h1>'
    
    # Добавляем содержимое Seed Data.md
    try:
        with open('Seed Data (Наполнение базы при старте).md', 'r', encoding='utf-8') as f:
            seed_content = f.read()
            seed_html = seed_content.replace('#', '<h2>').replace('\n#', '\n<h2>')
            seed_html = seed_html.replace('**', '<strong>').replace('**', '</strong>')
            seed_html = seed_html.replace('*', '<em>').replace('*', '</em>')
            seed_html = seed_html.replace('\n\n', '</p><p>').replace('\n', '<br>')
            seed_html = '<p>' + seed_html + '</p>'
            html_content += f'<div>{seed_html}</div>'
    except Exception as e:
        print(f'Ошибка чтения Seed Data.md: {e}')
        html_content += '<p>❌ Ошибка загрузки Seed Data.md</p>'
    
    html_content += """
    </div>
    
    <div id="architecture" class="page-break">
        <h1>7. Архитектурная диаграмма</h1>
        <div class="diagram-placeholder">
            <h2>🏗️ Интерактивная архитектурная диаграмма</h2>
            <p>Интерактивная диаграмма доступна в файле <strong>architecture-diagram.html</strong></p>
            <p>Диаграмма включает:</p>
            <ul>
                <li>📊 Общая архитектура системы</li>
                <li>🔄 Multi-Tenant изоляция данных</li>
                <li>👤 Полный сценарий регистрации и заказа</li>
                <li>🏗️ Структура проекта (Clean Architecture)</li>
                <li>📈 Итоговая сводка всех компонентов</li>
            </ul>
            <p><strong>Откройте architecture-diagram.html в браузере для просмотра интерактивной диаграммы</strong></p>
        </div>
    </div>
    
    <div class="page-break">
        <h1>📞 Контакты и информация</h1>
        <p><strong>Проект:</strong> Multi-Tenant SaaS Order Management System</p>
        <p><strong>Версия документации:</strong> 1.0</p>
        <p><strong>Дата сборки:</strong> """ + str(os.path.getmtime('README.md')) + """</p>
        <p><strong>Технологии:</strong> ASP.NET Core 8, EF Core, PostgreSQL, Redis, Hangfire, SignalR, MudBlazor</p>
    </div>
</body>
</html>"""
    
    # Сохраняем HTML
    with open('documentation.html', 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print('✅ HTML файл создан: documentation.html')
    return 'documentation.html'

def convert_to_pdf():
    """Конвертирует HTML в PDF используя различные методы"""
    
    # Метод 1: weasyprint
    try:
        import weasyprint
        html_doc = weasyprint.HTML(filename='documentation.html')
        html_doc.write_pdf('Multi-Tenant-SaaS-Order-Management-Documentation.pdf')
        print('✅ PDF успешно создан: Multi-Tenant-SaaS-Order-Management-Documentation.pdf')
        return True
    except ImportError:
        print('⚠️ WeasyPrint не установлен. Попробуем другой метод...')
    except Exception as e:
        print(f'⚠️ Ошибка WeasyPrint: {e}')
    
    # Метод 2: pdfkit (wkhtmltopdf)
    try:
        import pdfkit
        options = {
            'page-size': 'A4',
            'margin-top': '0.75in',
            'margin-right': '0.75in',
            'margin-bottom': '0.75in',
            'margin-left': '0.75in',
            'encoding': "UTF-8",
            'no-outline': None
        }
        pdfkit.from_file('documentation.html', 'Multi-Tenant-SaaS-Order-Management-Documentation.pdf', options=options)
        print('✅ PDF успешно создан: Multi-Tenant-SaaS-Order-Management-Documentation.pdf')
        return True
    except ImportError:
        print('⚠️ pdfkit не установлен. Попробуем другой метод...')
    except Exception as e:
        print(f'⚠️ Ошибка pdfkit: {e}')
    
    # Метод 3: playwright
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto('file://' + os.path.abspath('documentation.html'))
            page.pdf(
                path='Multi-Tenant-SaaS-Order-Management-Documentation.pdf',
                format='A4',
                print_background=True,
                margin={'top': '0.75in', 'right': '0.75in', 'bottom': '0.75in', 'left': '0.75in'}
            )
            browser.close()
        print('✅ PDF успешно создан: Multi-Tenant-SaaS-Order-Management-Documentation.pdf')
        return True
    except ImportError:
        print('⚠️ Playwright не установлен. Попробуем другой метод...')
    except Exception as e:
        print(f'⚠️ Ошибка Playwright: {e}')
    
    return False

def main():
    """Основная функция"""
    print('🚀 Создание PDF документации...')
    
    # Создаем HTML
    html_file = create_html_documentation()
    
    # Конвертируем в PDF
    success = convert_to_pdf()
    
    if not success:
        print('\n❌ Не удалось создать PDF автоматически.')
        print('\n💡 Установите одну из библиотек:')
        print('   pip install weasyprint')
        print('   pip install pdfkit')
        print('   pip install playwright')
        print('\n📄 HTML файл создан: documentation.html')
        print('   Вы можете открыть его в браузере и "Печать → Сохранить как PDF"')
    else:
        print('\n🎉 Готово! PDF файл создан:')
        print('   📄 Multi-Tenant-SaaS-Order-Management-Documentation.pdf')
        print('   🌐 HTML версия: documentation.html')

if __name__ == '__main__':
    main()
