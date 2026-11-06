# Offline Chromium smoke test, requires Python Playwright and a local Chromium installation.
# Note: set_content() uses a controlled mock localStorage because the sandbox blocks navigation.
# Tests application persistence logic but not a real origin's storage durability.
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys
root=Path(__file__).resolve().parents[1]
h=(root/'standalone.html').read_text()
print('HTML bytes',len(h))
js='''() => { const store = new Map(); Object.defineProperty(window, 'localStorage', {configurable:true, value:{getItem:(k)=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:(k)=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size;}}}); }'''
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.evaluate(js)
 page.set_content(h,wait_until='load')
 assert page.locator('#metric-total').inner_text()=='150'
 assert page.locator('#metric-incidents').inner_text()=='4'
 assert page.locator('#metric-high').inner_text()=='2'
 print('TEST 1: initial dashboard metrics PASS')
 page.screenshot(path=str(root/'docs/checkpoint2-browser-test-desktop.png'),full_page=True)
 print('NAV',[(el.get_attribute('data-route'), el.inner_text()[:20]) for el in page.locator('[data-route]').all()[:8]])
 page.locator('[data-route="incidents"]').first.click();assert page.locator('#full-incidents .incident-row').count()==4
 page.locator('#full-incidents .incident-row').first.click()
 page.locator('#case-status').select_option('investigating')
 page.locator('#case-note').fill('점검 2차: 임계값 근거와 원본 로그 확인 완료')
 page.locator('#save-case').click();assert '조사 중' in page.locator('#full-incidents .incident-row').first.inner_text()
 print('TEST 2: incident status & note save PASS')
 page.set_content(h,wait_until='load')
 page.locator('[data-route="incidents"]').first.click();page.locator('#full-incidents .incident-row').first.click()
 assert page.locator('#case-status').input_value()=='investigating'
 assert '점검 2차' in page.locator('#case-note').input_value()
 page.locator('#close-drawer').click()
 print('TEST 3: reloading document retains state PASS')
 with page.expect_download() as d:page.locator('#export-report').click()
 report=d.value
 report_text=Path(report.path()).read_text()
 assert '점검 2차' in report_text and '조사 중' in report_text
 print('TEST 4: Markdown report including saved analysis PASS',report.suggested_filename,len(report_text))
 page.locator('[data-route="events"]').first.click();page.locator('#event-search').fill('203.0.113.24')
 summ=page.locator('#events-summary').inner_text();assert '7건' in summ,(summ,page.locator('#events-body').inner_text())
 print('TEST 5: search filtering PASS',summ)
 with page.expect_download() as d:page.locator('#download-csv').click()
 csv=Path(d.value.path()).read_text(encoding='utf-8-sig');assert len(csv.splitlines())==151
 print('TEST 6: CSV export 150 rows PASS')
 btns=[(a.get_attribute('id'),a.inner_text()[:30]) for a in page.get_by_role('button').all() if '가져오기' in a.inner_text()]
 print('upload buttons',btns)
 # route to import
 if btns:
  page.get_by_role('button',name='로그 가져오기').first.click()
 elif page.locator('#open-import').count():page.locator('#open-import').click()
 else:
  print('input modal not triggered; all button ids:',[(a.get_attribute('id'),a.inner_text()[:12]) for a in page.get_by_role('button').all()][:20]);sys.exit(2)
 assert page.locator('#modal-overlay').is_visible()
 page.locator('#log-file').set_input_files(str(root/'examples/synthetic-events.csv'))
 page.wait_for_timeout(150)
 assert page.locator('#metric-total').inner_text()=='150'
 assert page.locator('#metric-incidents').inner_text()=='4'
 assert page.locator('#source-name').inner_text()=='synthetic-events.csv'
 print('TEST 7: CSV import PASS')
 # JSON
 if btns:page.get_by_role('button',name='로그 가져오기').first.click()
 else:page.locator('#open-import').click()
 page.locator('#log-file').set_input_files(str(root/'examples/synthetic-events.json'))
 page.wait_for_timeout(150)
 assert page.locator('#metric-total').inner_text()=='150' and page.locator('#source-name').inner_text()=='synthetic-events.json'
 print('TEST 8: JSON import PASS')
 # status absent should be treated as N/A, not 200
 page.get_by_role('button',name='로그 가져오기').first.click()
 page.locator('#log-file').set_input_files({"name":"missing-status.csv","mimeType":"text/csv","buffer":b'timestamp,ip,username,path,method,message\n2026-11-06T03:00:00Z,203.0.113.21,demo,/ping,GET,no status'})
 page.locator('[data-route="events"]').first.click()
 assert page.locator('#events-body').get_by_text('N/A').count()==1
 print('TEST 9: unknown HTTP status is N/A PASS')
 # mobile
 m=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,device_scale_factor=1)
 errs2=[];m.on('pageerror',lambda x:errs2.append(str(x)))
 m.evaluate(js)
 m.set_content(h,wait_until='load')
 m.screenshot(path=str(root/'docs/checkpoint2-browser-test-mobile.png'),full_page=True)
 widths=(m.evaluate('document.documentElement.scrollWidth'),m.evaluate('window.innerWidth'))
 print('MOBILE',widths,'menu',m.locator('#mobile-menu').is_visible())
 assert m.locator('#mobile-menu').is_visible()
 m.locator('#mobile-menu').click();print('open aria',m.locator('#mobile-menu').get_attribute('aria-expanded'),'sidebar classes',m.locator('.sidebar').get_attribute('class'))
 assert m.locator('#mobile-menu').get_attribute('aria-expanded')=='true'
 m.locator('[data-route="incidents"]').first.click()
 assert m.locator('#full-incidents .incident-row').count()==4
 print('TEST 10: mobile navigation & case list PASS')
 print('JS errors desktop:',errs,'mobile:',errs2)
 assert not errs and not errs2
 browser.close()
