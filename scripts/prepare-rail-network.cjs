// Offline cartographic preparation. The raw public datasets stay in ignored reference/.
const fs=require('node:fs'),crypto=require('node:crypto');
const config=require('../src/content/rail-locations.json');
const read=f=>JSON.parse(fs.readFileSync(`reference/map-v12/${f}`));
const world=read('railroads.geojson'),supplement=read('railroads-na.geojson');
const project=([lon,lat])=>[(lon+180)*1000/360,(90-lat)*500/180];
const lines=f=>f.geometry.type==='MultiLineString'?f.geometry.coordinates:[f.geometry.coordinates];
const round=x=>Math.round(x*10000)/10000;
function simplify(p,t){if(p.length<3)return p;let max=0,index=0;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;for(let i=1;i<p.length-1;i++){const q=p[i],u=len?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/len)):0,d=(q[0]-a[0]-u*dx)**2+(q[1]-a[1]-u*dy)**2;if(d>max){max=d;index=i;}}return max>t*t?[...simplify(p.slice(0,index+1),t).slice(0,-1),...simplify(p.slice(index),t)]:[a,b];}
const path=points=>points.map((p,i)=>`${i?'L':'M'}${round(p[0])},${round(p[1])}`).join('');
// Clip each segment in a local kilometre plane to the exact neighbourhood circle.
function clipped(line,location){const cos=Math.cos(location.lat*Math.PI/180),km=111.195,r=config.nearbyRadiusKm,result=[];for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],x=(a[0]-location.lon)*km*cos,y=(a[1]-location.lat)*km,dx=(b[0]-a[0])*km*cos,dy=(b[1]-a[1])*km,A=dx*dx+dy*dy,B=2*(x*dx+y*dy),C=x*x+y*y-r*r,D=B*B-4*A*C;if(!A||D<0)continue;const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));if(hi>lo)result.push([project([a[0]+lo*(b[0]-a[0]),a[1]+lo*(b[1]-a[1])]),project([a[0]+hi*(b[0]-a[0]),a[1]+hi*(b[1]-a[1])])]);}return result;}
const eligible=world.features.filter(f=>f.properties.featurecla==='Railroad');
const all=[...eligible,...supplement.features];
const worldPath=eligible.filter(f=>f.properties.scalerank<=6).flatMap(lines).map(l=>path(simplify(l.map(project),.45))).join('');
const regionalPath=eligible.filter(f=>f.properties.scalerank<=8).flatMap(lines).map(l=>path(simplify(l.map(project),.13))).join('');
const localPath=all.flatMap(lines).map(l=>path(simplify(l.map(project),.015))).join('');
const nearby=config.locations.map(l=>{const routes=[];for(const line of all.flatMap(lines)){const segments=clipped(line,l),chains=[];for(const segment of segments){const last=chains.at(-1);if(last&&Math.hypot(...last.at(-1).map((v,i)=>v-segment[0][i]))<.00001)last.push(segment[1]);else chains.push([...segment]);}const origin=project([l.lon,l.lat]);for(const chain of chains){let nearest=0;for(let i=1;i<chain.length;i++)if(Math.hypot(chain[i][0]-origin[0],chain[i][1]-origin[1])<Math.hypot(chain[nearest][0]-origin[0],chain[nearest][1]-origin[1]))nearest=i;for(const branch of [chain.slice(0,nearest+1).reverse(),chain.slice(nearest)])if(branch.length>1)routes.push(path(simplify(branch,.003)));}}return {code:l.code,path:routes.join(''),routes,segments:routes.length};});
const usa=read('countries-50m.geojson').features.find(f=>f.properties.ADM0_A3==='USA');
const polygons=usa.geometry.type==='MultiPolygon'?usa.geometry.coordinates:[usa.geometry.coordinates];
const localLand=polygons.flatMap(poly=>poly.map(ring=>path(simplify(ring.map(project),.025))+'Z')).join('');
// Land and highlighted countries share exactly the same vertices and projection.
const geography=require('../src/content/rail-map.json'),countries=read('countries-110m.geojson').features;
const countryPath=f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).flatMap(poly=>poly.map(ring=>simplify(ring.map(project),.025).map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')+'Z')).join('');
geography.landPath=countries.map(countryPath).join('');
for(const region of geography.regions)region.path=countries.filter(f=>region.id==='north-america'?f.properties.CONTINENT==='North America':f.properties.ADM0_A3==='CHN').map(countryPath).join('');
geography.provenance={source:'Natural Earth 110m countries; identical base and region vertices; 50m USA land is used only in local views',url:'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson',license:'Public domain'};
fs.writeFileSync('src/content/rail-map.json',JSON.stringify(geography)+'\n');
const hashes=Object.fromEntries(['railroads.geojson','railroads-na.geojson','countries-50m.geojson'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(`reference/map-v12/${f}`)).digest('hex')]));
fs.writeFileSync('src/content/rail-network.json',JSON.stringify({provenance:{source:'Natural Earth 10m railroads and North America supplement; 50m countries',urls:['https://www.naturalearthdata.com/downloads/10m-cultural-vectors/railroads/','https://github.com/nvkelso/natural-earth-vector/tree/master/geojson'],license:'Public domain',hashes,note:'Cartographic context, not PSA project extents; historical dataset, not operational navigation.'},worldPath,regionalPath,localPath,localLand,nearby})+'\n');
console.log({world:worldPath.length,regional:regionalPath.length,localLand:localLand.length,nearby:nearby.map(l=>[l.code,l.segments])});
