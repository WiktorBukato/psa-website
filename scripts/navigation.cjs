const site=require('../src/site.json');
const vertical=id=>site.verticals.find(page=>page.id===id);
module.exports={forVertical:id=>vertical(id)?.navigation||site.navigation,breakpoint:id=>vertical(id)?.menuBreakpoint||900};
