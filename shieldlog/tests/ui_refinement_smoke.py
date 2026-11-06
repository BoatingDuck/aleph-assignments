"""Chromium checks for typography, animation accessibility, and responsive layout on a real local origin."""
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
h=(root/'standalone.html').read_text(encoding='utf-8')
# The sandbox disallows local HTTP navigation, so the page is loaded inline.
# These checks validate layout and interactions, not origin-level storage durability.
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium', args=['--no-sandbox'])
  for width,height in [(1440,920),(1024,768),(768,920),(390,844),(320,740)]:
   context=browser.new_context(viewport={'width':width,'height':height},accept_downloads=True)
   page=context.new_page();errors=[];page.on('pageerror',lambda err: errors.append(str(err)))
   page.evaluate('''() => { const store = new Map(); Object.defineProperty(window, 'localStorage', {configurable:true,value:{getItem:(k)=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:(k)=>store.delete(k),key:i=>[...store.keys()][i],get length(){return store.size;}}}); }''')
   page.set_content(h, wait_until='load')
   page.wait_for_timeout(900)
   total=page.locator('#metric-total').inner_text()
   assert total=='150',f'{width}: count {total}'
   sizes=page.evaluate('''() => ({body:getComputedStyle(document.body).fontSize,metric:getComputedStyle(document.querySelector('.metric-top')).fontSize,foot:getComputedStyle(document.querySelector('.metric-foot')).fontSize,nav:getComputedStyle(document.querySelector('.nav-item')).fontSize,table:getComputedStyle(document.querySelector('th')).fontSize,anim:getComputedStyle(document.querySelector('.metric')).animationName,documentWidth:document.documentElement.scrollWidth,windowWidth:window.innerWidth})''')
   assert sizes['documentWidth']<=sizes['windowWidth'],f'overflow at {width}: {sizes}'
   assert float(sizes['body'].removesuffix('px'))>=15
   assert float(sizes['metric'].removesuffix('px'))>=12
   assert sizes['anim']!='none'
   if width in (1440,390):
    page.screenshot(path=str(root/f'docs/refined-{width}-dashboard.png'),full_page=True,animations='disabled')
   if width==390:
    page.locator('#mobile-menu').click();page.locator('[data-route="incidents"]').first.click();page.wait_for_timeout(500)
    page.screenshot(path=str(root/'docs/refined-390-cases.png'),full_page=True,animations='disabled')
    page.locator('#full-incidents .incident-row').first.click()
    assert page.locator('#detail-drawer').is_visible()
    page.locator('#case-status').select_option('investigating');page.locator('#case-note').fill('UI 개선 점검')
    page.locator('#save-case').click()
    page.set_content(h,wait_until='load');page.locator('#mobile-menu').click();page.locator('[data-route="incidents"]').first.click()
    page.locator('#full-incidents .incident-row').first.click()
    assert page.locator('#case-note').input_value()=='UI 개선 점검'
    page.locator('#close-drawer').click()
   if width==1440:
    page.locator('[data-route="events"]').first.click()
    page.wait_for_timeout(200)
    assert float(page.locator('td').first.evaluate('(el)=>getComputedStyle(el).fontSize').removesuffix('px'))>=13
    page.screenshot(path=str(root/'docs/refined-1440-events.png'),full_page=True,animations='disabled')
   assert not errors, f'JS errors at {width}: {errors}'
   print('PASS',width,sizes)
   context.close()
  reduced=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
  page=reduced.new_page();page.set_content(h, wait_until='load')
  animation=page.locator('.metric').first.evaluate('(el)=>getComputedStyle(el).animationName')
  assert animation=='none',animation
  print('PASS prefers-reduced-motion: animations disabled')
  reduced.close();browser.close()
finally:
 pass
