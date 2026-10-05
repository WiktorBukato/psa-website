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
function clipped(line,location,r=config.nearbyRadiusKm){const cos=Math.cos(location.lat*Math.PI/180),km=111.195,result=[];for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],x=(a[0]-location.lon)*km*cos,y=(a[1]-location.lat)*km,dx=(b[0]-a[0])*km*cos,dy=(b[1]-a[1])*km,A=dx*dx+dy*dy,B=2*(x*dx+y*dy),C=x*x+y*y-r*r,D=B*B-4*A*C;if(!A||D<0)continue;const lo=Math.max(0,(-B-Math.sqrt(D))/(2*A)),hi=Math.min(1,(-B+Math.sqrt(D))/(2*A));if(hi>lo)result.push([project([a[0]+lo*(b[0]-a[0]),a[1]+lo*(b[1]-a[1])]),project([a[0]+hi*(b[0]-a[0]),a[1]+hi*(b[1]-a[1])])]);}return result;}
const eligible=world.features.filter(f=>f.properties.featurecla==='Railroad');
const all=[...eligible,...supplement.features];
const worldPath=eligible.filter(f=>f.properties.scalerank<=6).flatMap(lines).map(l=>path(simplify(l.map(project),.45))).join('');
const regionalPath=eligible.filter(f=>f.properties.scalerank<=8).flatMap(lines).map(l=>path(simplify(l.map(project),.13))).join('');

const detail=read('fra-local.geojson');
// Replace generalized lines inside the downloaded public detail extents.
function outsideDetail(line){const chains=[];for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],cuts=[0,1];for(const box of detail.boxes){for(const [axis,edge] of [[0,box[0]],[0,box[2]],[1,box[1]],[1,box[3]]]){const d=b[axis]-a[axis];if(d){const t=(edge-a[axis])/d;if(t>0&&t<1)cuts.push(t);}}}cuts.sort((a,b)=>a-b);for(let j=1;j<cuts.length;j++){const lo=cuts[j-1],hi=cuts[j],at=t=>a.map((v,k)=>v+(b[k]-v)*t),mid=at((lo+hi)/2);if(detail.boxes.some(box=>mid[0]>=box[0]&&mid[0]<=box[2]&&mid[1]>=box[1]&&mid[1]<=box[3]))continue;const start=at(lo),end=at(hi),last=chains.at(-1);if(last&&Math.hypot(...last.at(-1).map((v,k)=>v-start[k]))<1e-7)last.push(end);else chains.push([start,end]);}}return chains;}
const outsideLines=all.flatMap(lines).flatMap(outsideDetail),fineLines=detail.features.flatMap(lines),detailedLines=[...outsideLines,...fineLines];
const localPath=outsideLines.map(l=>path(simplify(l.map(project),.015))).join('')+fineLines.map(l=>path(simplify(l.map(project),.0007))).join('');
function neighbourhood(location,source,radius){const routes=[];for(const line of source){const segments=clipped(line,location,radius),chains=[];for(const segment of segments){const last=chains.at(-1);if(last&&Math.hypot(...last.at(-1).map((v,i)=>v-segment[0][i]))<.00001)last.push(segment[1]);else chains.push([...segment]);}const origin=project([location.lon,location.lat]);for(const chain of chains){let nearest=0;for(let i=1;i<chain.length;i++)if(Math.hypot(chain[i][0]-origin[0],chain[i][1]-origin[1])<Math.hypot(chain[nearest][0]-origin[0],chain[nearest][1]-origin[1]))nearest=i;for(const branch of [chain.slice(0,nearest+1).reverse(),chain.slice(nearest)])if(branch.length>1){const points=simplify(branch,.0007),length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0),distance=Math.hypot(points[0][0]-origin[0],points[0][1]-origin[1]);routes.push({path:path(points),length,distance});}}}const moving=routes.filter(r=>r.length>.03).sort((a,b)=>(a.distance+.1)/a.length-(b.distance+.1)/b.length).slice(0,48);return {routes:moving.map(r=>r.path),segments:moving.length};}
const overviewLines=eligible.filter(f=>f.properties.scalerank<=6).flatMap(lines);
const nearby=config.locations.map(l=>({code:l.code,...neighbourhood(l,detailedLines,config.nearbyRadiusKm),overview:neighbourhood(l,overviewLines,config.maximumRadiusKm)}));
const corridors=require('./rail-corridors.cjs').joinLines(detailedLines);
function continuous(location){const origin=project([location.lon,location.lat]),candidates=[];for(const line of corridors){const segments=clipped(line,location,config.maximumRadiusKm),chains=[];for(const segment of segments){const last=chains.at(-1);if(last&&Math.hypot(...last.at(-1).map((v,i)=>v-segment[0][i]))<.00001)last.push(segment[1]);else chains.push([...segment]);}for(const chain of chains){const points=simplify(chain,.0007),length=points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0),distance=Math.min(...points.map(p=>Math.hypot(p[0]-origin[0],p[1]-origin[1])));if(length>.03)candidates.push({path:path(points),length,distance});}}
 const close=[...candidates].sort((a,b)=>a.distance-b.distance||b.length-a.length).slice(0,24),wide=candidates.filter(r=>r.length>config.localViewportWidth/2).sort((a,b)=>(a.distance+.1)/Math.sqrt(a.length)-(b.distance+.1)/Math.sqrt(b.length)).slice(0,48);return [...new Set([...close,...wide].map(r=>r.path))];}
for(const n of nearby)n.continuous=continuous(config.locations.find(l=>l.code===n.code));
const usa=read('countries-10m.geojson').features.find(f=>f.properties.ADM0_A3==='USA');
const polygons=usa.geometry.type==='MultiPolygon'?usa.geometry.coordinates:[usa.geometry.coordinates];
const localLand=polygons.flatMap(poly=>poly.map(ring=>path(simplify(ring.map(project),.001))+'Z')).join('');
// Land and highlighted countries share exactly the same vertices and projection.
const geography=require('../src/content/rail-map.json'),countries=read('countries-110m.geojson').features;
const countryPath=f=>(f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]).flatMap(poly=>poly.map(ring=>simplify(ring.map(project),.025).map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')+'Z')).join('');
geography.landPath=countries.map(countryPath).join('');
for(const region of geography.regions)region.path=countries.filter(f=>region.id==='north-america'?f.properties.CONTINENT==='North America':f.properties.ADM0_A3==='CHN').map(countryPath).join('');
geography.provenance={source:'Natural Earth 110m countries; identical base and region vertices; 10m USA land is used only in local views',url:'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson',license:'Public domain'};
fs.writeFileSync('src/content/rail-map.json',JSON.stringify(geography)+'\n');
const hashes=Object.fromEntries(['railroads.geojson','railroads-na.geojson','countries-10m.geojson','countries-110m.geojson','fra-local.geojson'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(`reference/map-v12/${f}`)).digest('hex')]));
fs.writeFileSync('src/content/rail-network.json',JSON.stringify({provenance:{source:'Natural Earth 10m railroads and North America supplement; 10m countries; local FRA/BTS NARN geometry',urls:['https://railroads.fra.dot.gov/rail-network-development/maps-and-data/maps-geographic-information-system/maps-geographic','https://github.com/nvkelso/natural-earth-vector/tree/master/geojson'],license:'Public domain',hashes,note:'Cartographic context, not PSA project extents; historical dataset, not operational navigation.'},worldPath,regionalPath,localPath,localLand,nearby})+'\n');
console.log({world:worldPath.length,regional:regionalPath.length,localLand:localLand.length,nearby:nearby.map(l=>[l.code,l.segments])});
