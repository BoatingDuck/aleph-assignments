export const KMA_SOURCE='https://www.weather.go.kr/w/weather/land/city-obs.do';
export function parseKmaObservation(html:string){
 const timeHeader=html.match(/<div\b[^>]*class=["']cmp-table-topinfo["'][^>]*>([\s\S]*?)<\/div>/i);
 const time=timeHeader?.[1].match(/(\d{4})\.(\d{1,2})\.(\d{1,2})\.(\d{1,2}):(\d{2})/);
 const table=html.match(/<table\b[^>]*id=["']weather_table["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
 if(!time||!table||!/<th\b[^>]*headers=["']headers-temp["'][^>]*>\s*현재\s*<br\s*\/?\s*>\s*기온\s*<\/th>/i.test(table))throw new Error('schema_error');
 const stationRow=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].find(m=>/stn=133["'&]/.test(m[1])&&/>\s*대전\s*<\/a>/.test(m[1]));
 if(!stationRow)throw new Error('schema_error');
 const cells=[...stationRow[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
 const text=cells[5]?.[1].replace(/<[^>]*>/g,'').trim();
 if(cells.length!==13||!text||!/^[-+]?\d+(?:\.\d+)?$/.test(text))throw new Error('schema_error');
 const value=Number(text);if(!Number.isFinite(value)||value< -80||value>60)throw new Error('schema_error');
 const [year,month,day,hour,minute]=time.slice(1);const observed=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${hour.padStart(2,'0')}:${minute}:00+09:00`;
 if(!Number.isFinite(Date.parse(observed)))throw new Error('schema_error');
 const query=`${year}.${month}.${day}.${hour}:${minute}`;
 return {value,observed,sourceUrl:`${KMA_SOURCE}?tm=${encodeURIComponent(query)}`,raw:{format:'기상청 도시별 관측 HTML 발췌',station_id:'133',station_name:'대전',temperature_text:text,unit:'°C',observation_time_text:time[0],time_header_html:timeHeader![0],station_row_html:stationRow[0]}};
}
