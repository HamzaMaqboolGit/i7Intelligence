from pathlib import Path
for i in range(8):
 dark=i>=4
 bg='#080F1D' if dark else '#EBEEF2'
 defs='''<defs><linearGradient id="metal"><stop stop-color="#5f6772"/><stop offset=".3" stop-color="#171d26"/><stop offset=".6" stop-color="#a9afb8"/><stop offset="1" stop-color="#161b24"/></linearGradient><linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172B49"/><stop offset=".5" stop-color="#03060B"/><stop offset="1" stop-color="#101D33"/></linearGradient><linearGradient id="rock"><stop stop-color="#8b9199"/><stop offset="1" stop-color="#303640"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="35" stdDeviation="22" flood-opacity=".24"/></filter></defs>'''
 beams=''.join(f'<path d="M-100 {900-k*100}L900 {200+k*50}" stroke="#243D60" stroke-width="{6-k}" opacity=".5"/>' for k in range(5)) if dark else ''
 if i==0:
  device='''<g filter="url(#shadow)"><path d="M390 160L530 250V660L390 575Q370 565 370 545V180Q370 150 390 160Z" fill="url(#metal)"/><path d="M390 172L515 253V640L385 561Z" fill="#030609"/><path d="M545 250L690 160Q710 152 710 180V545Q710 565 690 575L545 660Z" fill="url(#metal)"/><path d="M553 256L695 175V550L553 641Z" fill="#05080D"/><path d="M530 254V650M540 254V650" stroke="#9ba4b0" stroke-width="4"/></g>'''
 elif i==3:
  device='''<path d="M0 650L140 610L260 630L390 600L520 650L800 590V1000H0Z" fill="url(#rock)"/><g transform="rotate(-8 420 400)" filter="url(#shadow)"><rect x="370" y="150" width="150" height="470" rx="25" fill="url(#metal)"/><rect x="378" y="157" width="134" height="455" rx="21" fill="url(#screen)"/></g>'''
 else:
  rock='<path d="M0 700L800 650V1000H0Z" fill="url(#rock)"/>' if i==2 else ''
  angle=-12 if i%2 else 8
  keys=''.join(f'<rect x="{160+c*36}" y="{605+r*25}" width="28" height="16" rx="3" fill="#0b0f16" stroke="#59616e" stroke-width="1"/>' for r in range(4) for c in range(13))
  device=rock+f'''<g transform="translate(0 {-70 if i==2 else 0}) rotate({angle} 400 450)" filter="url(#shadow)"><path d="M180 220Q180 205 200 205H650Q670 205 670 225V580H180Z" fill="url(#metal)"/><rect x="190" y="218" width="470" height="350" rx="5" fill="url(#screen)"/><circle cx="425" cy="212" r="2" fill="#858C98"/><path d="M180 580H670L755 745Q760 755 740 760H90Q70 755 80 745Z" fill="url(#metal)"/>{keys}<path d="M300 710H525L535 740H290Z" fill="#262d39" stroke="#78818d"/><path d="M80 752H750" stroke="#a5afbf" stroke-width="4"/></g>'''
 Path(f'public/art/device-{i}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">{defs}<rect width="800" height="1000" fill="{bg}"/>{beams}{device}</svg>')
