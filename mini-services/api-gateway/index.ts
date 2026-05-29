const PORT = 3030;

const A_SHARE: Record<string, {n:string;p:number}> = {
  'SH600519':{n:'贵州茅台',p:1688.50},'SH601318':{n:'中国平安',p:48.35},
  'SZ000001':{n:'平安银行',p:12.68},'SH600036':{n:'招商银行',p:35.42},
  'SZ000858':{n:'五粮液',p:148.90},'SH601398':{n:'工商银行',p:5.48},
  'SH600276':{n:'恒瑞医药',p:45.20},'SZ002714':{n:'牧原股份',p:38.65},
  'SH600030':{n:'中信证券',p:22.15},'SZ300750':{n:'宁德时代',p:178.50},
  'SH600900':{n:'长江电力',p:28.75},'SZ000333':{n:'美的集团',p:62.30},
  'SH601888':{n:'中国中免',p:78.40},'SH600809':{n:'山西汾酒',p:218.60},
  'SZ002475':{n:'立讯精密',p:33.80},'SH601899':{n:'紫金矿业',p:15.20},
  'SH000001':{n:'上证指数',p:3268.50},'SZ399001':{n:'深证成指',p:10456.80},
  'SZ399006':{n:'创业板指',p:2089.30},
};

const HK_SHARE: Record<string, {n:string;p:number}> = {
  'HK00700':{n:'腾讯控股',p:378.40},'HK09988':{n:'阿里巴巴',p:82.65},
  'HK03690':{n:'美团',p:128.50},'HK00005':{n:'汇丰控股',p:68.35},
  'HK01299':{n:'友邦保险',p:58.90},'HK01810':{n:'小米集团',p:18.95},
  'HK09618':{n:'京东集团',p:128.30},'HSI':{n:'恒生指数',p:19632.50},
};

const US_NAMES: Record<string,string> = {
  'AAPL':'Apple Inc.','GOOGL':'Alphabet Inc.','MSFT':'Microsoft Corp.',
  'AMZN':'Amazon.com','NVDA':'NVIDIA Corp.','META':'Meta Platforms',
  'TSLA':'Tesla Inc.','JPM':'JPMorgan Chase','AMD':'AMD','NFLX':'Netflix',
};

function rp(b:number){const c=(Math.random()-0.48)*6;const ch=b*(c/100);const cp=b+ch;const o=b+(Math.random()-0.5)*b*0.01;return{currentPrice:+cp.toFixed(2),change:+ch.toFixed(2),changePercent:+c.toFixed(2),high:+(Math.max(cp,o)+Math.random()*b*0.008).toFixed(2),low:+(Math.min(cp,o)-Math.random()*b*0.008).toFixed(2),open:+o.toFixed(2),prevClose:b,volume:Math.floor(1e7+Math.random()*9e7)};}

function dm(s:string){const u=s.toUpperCase();if(u.startsWith('SH')||u.startsWith('SZ'))return'A';if(u.startsWith('HK')||u==='HSI')return'HK';return'US';}

const headers = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

Bun.serve({
  port: PORT,
  fetch(req: Request) {
    const u=new URL(req.url);
    const p=u.pathname;

    if(req.method==='OPTIONS')return new Response(null,{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
    if(p==='/health')return Response.json({status:'ok',uptime:process.uptime()});

    try {
      if(p==='/api/fusion/market/quote'){
        const sym=u.searchParams.get('symbol');
        const syms=u.searchParams.get('symbols');
        if(syms){
          const list=syms.split(',').filter(Boolean);
          const quotes=list.map((s:string)=>{const S=s.toUpperCase();const m=dm(S);const d=m==='A'?A_SHARE[S]:m==='HK'?HK_SHARE[S]:null;return d?{symbol:S,name:d.n,...rp(d.p),timestamp:Math.floor(Date.now()/1000),market:m}:{symbol:S,name:US_NAMES[S]||S,...rp(50+Math.random()*200),timestamp:Math.floor(Date.now()/1000),market:'US'};});
          return Response.json({success:true,data:quotes,error:null},{headers});
        }
        if(!sym)return Response.json({success:false,data:null,error:'Symbol required'},{headers});
        const S=sym.toUpperCase();const m=dm(S);
        if(m==='A'&&A_SHARE[S])return Response.json({success:true,data:{symbol:S,name:A_SHARE[S].n,...rp(A_SHARE[S].p),timestamp:Math.floor(Date.now()/1000),market:'A'},error:null},{headers});
        if(m==='HK'&&HK_SHARE[S])return Response.json({success:true,data:{symbol:S,name:HK_SHARE[S].n,...rp(HK_SHARE[S].p),timestamp:Math.floor(Date.now()/1000),market:'HK'},error:null},{headers});
        return Response.json({success:true,data:{symbol:S,name:US_NAMES[S]||S,...rp(50+Math.random()*200),timestamp:Math.floor(Date.now()/1000),market:'US'},error:null},{headers});
      }

      if(p==='/api/fusion/market/kline'){
        const sym=(u.searchParams.get('symbol')||'AAPL').toUpperCase();const cnt=parseInt(u.searchParams.get('count')||'60');
        const bp=dm(sym)==='A'&&A_SHARE[sym]?A_SHARE[sym].p:dm(sym)==='HK'&&HK_SHARE[sym]?HK_SHARE[sym].p:150;
        let price=bp*0.9;const c:number[]=[],h:number[]=[],l:number[]=[],o:number[]=[],v:number[]=[],t:number[]=[];const now=Math.floor(Date.now()/1000);
        for(let i=0;i<cnt;i++){t.push(now-(cnt-i)*86400);const vol=price*0.02;const drift=(bp-price)/(cnt-i)*0.3;const ch=drift+(Math.random()-0.5)*vol;const op=+price.toFixed(2);const cp=+(price+ch).toFixed(2);o.push(op);c.push(cp);h.push(+(Math.max(op,cp)+Math.random()*vol*0.5).toFixed(2));l.push(+(Math.min(op,cp)-Math.random()*vol*0.5).toFixed(2));v.push(Math.floor(2e7+Math.random()*8e7));price=cp;}
        return Response.json({success:true,data:{symbol:sym,period:'daily',c,h,l,o,v,t},error:null},{headers});
      }

      if(p==='/api/fusion/market/news'){
        const mkt=u.searchParams.get('market')||'A';const cnt=parseInt(u.searchParams.get('count')||'10');
        const newsA=[{h:'A股三大指数集体高开 半导体板块领涨',s:'受外围市场提振，半导体表现活跃',src:'财经网',sent:'bullish'},{h:'央行开展1500亿元逆回购操作',s:'维护月末流动性合理充裕',src:'证券时报',sent:'neutral'},{h:'白酒板块午后走强 茅台创新高',s:'消费复苏预期推动白酒上涨',src:'东方财富',sent:'bullish'},{h:'创业板指回调 科技股分化',s:'成交量萎缩，资金观望',src:'新浪财经',sent:'bearish'},{h:'新能源赛道重获资金青睐',s:'宁德时代带动锂电池走强',src:'第一财经',sent:'bullish'}];
        const items=newsA.slice(0,Math.min(cnt,5)).map((t,i)=>({id:`${mkt}-${Date.now()}-${i}`,headline:t.h,summary:t.s,source:t.src,sentiment:t.sent,relatedStocks:[],publishedAt:new Date(Date.now()-i*3600000).toISOString()}));
        return Response.json({success:true,data:items,error:null},{headers});
      }

      if(p==='/api/fusion/market/sectors'){
        const mkt=u.searchParams.get('market')||'A';
        const names=mkt==='A'?['白酒','新能源','银行','医药','证券','保险','电子','矿业','家电','电力','农业','旅游']:mkt==='HK'?['互联网','银行','保险','科技','电商','汽车']:['Technology','Healthcare','Finance','Consumer','Energy','Industrials'];
        const sectors=names.map(n=>({name:n,changePercent:+((Math.random()-0.48)*6).toFixed(2),volume:Math.floor(5e7+Math.random()*1e8),topStocks:[]}));
        return Response.json({success:true,data:sectors,error:null},{headers});
      }

      if(p==='/api/fusion/market/indicators'){
        const sym=(u.searchParams.get('symbol')||'AAPL').toUpperCase();
        return Response.json({success:true,data:{symbol:sym,ma:{ma5:150,ma10:148,ma20:146,ma60:142},rsi:{rsi6:55,rsi12:52,rsi14:50},macd:{dif:0.5,dea:0.3,macd:0.2},bollinger:{upper:158,middle:150,lower:142},kdj:{k:55,d:48,j:62}},error:null},{headers});
      }

      if(p==='/api/fusion/strategies'){
        const st=[{id:'ma_cross',name:'均线交叉策略',type:'trend',description:'5日/20日均线交叉',rating:4.2,parameters:['fast','slow']},{id:'macd_signal',name:'MACD信号策略',type:'trend',description:'MACD金叉死叉',rating:3.8,parameters:['fast','slow','signal']},{id:'rsi_divergence',name:'RSI背离策略',type:'reversal',description:'RSI与价格背离',rating:3.5,parameters:['period']},{id:'bollinger_breakout',name:'布林带突破策略',type:'volatility',description:'价格突破布林带',rating:4.0,parameters:['period','std']},{id:'kdj_golden_cross',name:'KDJ金叉策略',type:'momentum',description:'KDJ金叉买入',rating:3.6,parameters:['k','d']},{id:'turtle_trading',name:'海龟交易策略',type:'trend',description:'经典趋势跟踪',rating:4.3,parameters:['entry','exit','atr']},{id:'mean_reversion',name:'均值回归策略',type:'reversal',description:'价格偏离后回归',rating:3.7,parameters:['lookback']},{id:'scalping',name:'日内短线策略',type:'scalping',description:'超短线高频',rating:3.2,parameters:['target','stop']},{id:'swing_trading',name:'波段交易策略',type:'swing',description:'中线波段操作',rating:4.0,parameters:['period']},{id:'dividend_capture',name:'分红捕捉策略',type:'income',description:'分红除权日交易',rating:3.3,parameters:['days']},{id:'vwap_strategy',name:'VWAP执行策略',type:'execution',description:'算法交易执行',rating:3.6,parameters:['rate']},{id:'dual_thrust',name:'Dual Thrust策略',type:'breakout',description:'经典日内突破',rating:4.1,parameters:['range','k1','k2']},{id:'pairs_trading',name:'配对交易策略',type:'statistical',description:'统计套利',rating:3.8,parameters:['window']},{id:'volume_breakout',name:'放量突破策略',type:'volume',description:'成交量配合突破',rating:3.9,parameters:['ratio','change']},{id:'momentum_rotation',name:'动量轮动策略',type:'momentum',description:'板块轮动',rating:3.4,parameters:['period']}];
        return Response.json({success:true,data:st,error:null},{headers});
      }

      if(p==='/api/fusion/backtest/run'){
        const tr=+((Math.random()-0.3)*80).toFixed(2);
        return Response.json({success:true,data:{strategy:u.searchParams.get('strategy')||'ma_cross',symbol:u.searchParams.get('symbol')||'AAPL',totalReturn:tr,annualizedReturn:+(tr*0.7).toFixed(2),sharpeRatio:+(0.3+Math.random()*2.2).toFixed(2),maxDrawdown:+(-5-Math.random()*30).toFixed(2),winRate:+(40+Math.random()*25).toFixed(2),totalTrades:Math.floor(20+Math.random()*80),profitFactor:+(0.8+Math.random()*1.5).toFixed(2),avgHoldingDays:+(2+Math.random()*15).toFixed(1),trades:Array.from({length:10},(_,i)=>({id:i+1,entryPrice:+(100+Math.random()*200).toFixed(2),exitPrice:+(100+Math.random()*200).toFixed(2),quantity:Math.floor(10+Math.random()*90),pnl:+((Math.random()-0.4)*2000).toFixed(2)}))},error:null},{headers});
      }

      if(p==='/api/fusion/agent/chat'){
        return Response.json({success:true,data:{response:'你好！我是QuantFusion AI助手，我可以帮你分析股票、解读市场趋势、提供交易洞察。请问有什么可以帮你的？',source:'mock'},error:null},{headers});
      }

      if(p==='/api/fusion/analysis/start'){
        const sc=40+Math.floor(Math.random()*40);const rec=sc>=65?'BUY':sc>=45?'HOLD':'SELL';
        return Response.json({success:true,data:{symbol:u.searchParams.get('symbol')||'AAPL',mode:'standard',source:'mock',technical:'短期趋势偏多，MACD金叉',fundamental:'行业龙头，估值合理',sentiment:'市场情绪中性偏多',risk:'关注宏观经济不确定性',recommendation:rec,score:sc,confidence:'medium',summary:'综合评分'+sc+'分'},error:null},{headers});
      }

      if(p==='/api/fusion/ai/brief'){
        return Response.json({success:true,data:{brief:'📊 今日市场简报\n\n🇨🇳 A股：集体收涨，半导体领涨\n🇭🇰 港股：小幅上涨，南向资金流入\n🇺🇸 美股：三大指数创新高',source:'mock'},error:null},{headers});
      }

      if(p==='/api/fusion/system/status'){
        return Response.json({success:true,data:{services:{nextjs:{status:'running',port:3000},api_gateway:{status:'running',port:3030}},uptime:process.uptime()},error:null},{headers});
      }

      return Response.json({success:false,error:'Not found'},{status:404,headers});
    } catch(e:any) {
      return Response.json({success:false,error:e.message},{status:500,headers});
    }
  }
});
console.log('API Gateway on :3030');
