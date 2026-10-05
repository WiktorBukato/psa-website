// Join only coincident public-source endpoints, never invent missing rail connections.
function joinLines(lines){const nodes=new Map(),edges=[],key=p=>p.map(n=>Math.round(n*10000000)).join(',');const add=(k,i)=>{if(!nodes.has(k))nodes.set(k,[]);nodes.get(k).push(i);};
 for(const points of lines){if(points.length<2)continue;const a=key(points[0]),b=key(points.at(-1)),i=edges.length;edges.push({points,a,b,used:false});add(a,i);add(b,i);}
 const result=[];function walk(index,start){const points=[];let node=start;while(true){const e=edges[index];if(e.used)break;e.used=true;const forward=e.a===node,p=forward?e.points:[...e.points].reverse();points.push(...(points.length?p.slice(1):p));node=forward?e.b:e.a;const next=nodes.get(node);if(next.length!==2)break;index=next.find(i=>!edges[i].used);if(index===undefined)break;}return points;}
 for(let i=0;i<edges.length;i++){const e=edges[i];for(const node of [e.a,e.b])if(nodes.get(node).length!==2&&!e.used)result.push(walk(i,node));}
 for(let i=0;i<edges.length;i++)if(!edges[i].used)result.push(walk(i,edges[i].a));return result;
}
module.exports={joinLines};
