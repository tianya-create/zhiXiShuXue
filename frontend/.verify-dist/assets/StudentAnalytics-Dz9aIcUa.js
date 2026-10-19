import{r as me,N as d,a as ge}from"./notebook-colors-BLs2XVP5.js";import{M as P}from"./MathText-DPP58WNu.js";import{o as be,m as we,d as ye,L as A,M as j,P as c,a1 as o,X as r,e as h,Y as _e,O as L,_ as V,au as k,c as O,av as xe,r as w,a$ as ke,a_ as Ce,$ as m,a0 as R,p as Z,F as Se,al as Ae,H as ee}from"./vue-core-vendor-3vc5SEMl.js";import{r as H}from"./api-BUdvt2dp.js";import{e as Te,i as $e}from"./echarts-vendor-BCrH0nbs.js";import{_ as Me}from"./index-nvtWrEFb.js";import"./vendor-CVItYzdU.js";import"./http-utils-vendor-QXJvKKIU.js";import"./element-plus-vendor-zw3HIw_-.js";const Ne={class:"student-analytics"},Le={class:"card-header student-list-header"},Ve={class:"header-left"},Re={class:"card-header analytics-toolbar"},Ee={class:"toolbar-left"},ze={key:1,class:"chart-row"},Be={class:"chart-col"},De={class:"chart-col"},Ie={class:"chart-col"},Pe={__name:"StudentAnalytics",setup(je){me(Te);var te=ke(),ae=Ce(),E=w(!1),b=w(null),p=w(null),F=w(null),Q=w(null),W=w(null),y=null,_=null,x=null,$=null,z=w([]),T=w(""),q=w([]),C=w(""),S=O(function(){return te.params.id}),B=O(function(){return!p.value||!p.value.wrongQuestions?[]:p.value.wrongQuestions}),re=O(function(){if(!T.value)return z.value;var e=T.value.toLowerCase();return z.value.filter(function(t){return t.name.toLowerCase().includes(e)||t.studentNo.toLowerCase().includes(e)})});be(function(){ne(),U(),window.addEventListener("resize",X)}),we(function(){window.removeEventListener("resize",X),$&&window.clearTimeout($),J()}),ye(S,function(e){e?U():(p.value=null,b.value=null,J())});function ne(){H.get("/teacher/classes").then(function(e){e.success&&(q.value=e.data,e.data.length>0&&(C.value=e.data[0].id,K()))}).catch(function(e){console.error("加载班级失败:",e)})}function K(){C.value&&H.get("/teacher/classes/"+C.value+"/students").then(function(e){e.success&&(z.value=e.data)}).catch(function(e){console.error("加载学生失败:",e)})}function U(){S.value&&(E.value=!0,H.get("/teacher/analytics/student/"+S.value).then(function(e){if(e.success)return b.value=e.data.student,p.value=e.data,ee()}).then(function(){se()}).catch(function(e){console.error("加载失败:",e)}).finally(function(){E.value=!1}))}const oe={"kp-001":"有理数","kp-002":"加减法","kp-003":"乘除法","kp-005":"方程解法","kp-007":"平行线"};function Y(e){return oe[e]||e}function D(e){if(typeof e=="number")return e;var t=parseFloat(e);return isNaN(t)?0:t}function G(e){var t=e&&typeof e=="object"?e.avgScore:e,n=parseFloat(t);return isNaN(n)?0:n}function le(e){var t=Object.keys(e).map(function(l){return G(e[l])}).filter(function(l){return l>0});if(t.length===0)return 0;var n=t.reduce(function(l,a){return l+a},0);return Math.round(n/t.length)}function I(e,t){return e?!t||t.isDisposed()?$e(e,ge):t:null}function se(){ee(function(){$&&window.clearTimeout($),$=window.setTimeout(function(){var e=F.value,t=Q.value,n=W.value;if(!(!e||!t||!n||e.clientWidth===0)){var l=p.value||{},a=l.knowledgePointMastery||{};ie(e,l.scoreTrend||[]),ue(t,a),de(n,a,l.scoreTrend||[])}},80)})}function ie(e,t){if(y=I(e,y),!!y){var n=t.map(function(a,s){return a.date?a.date.slice(5,10):"第"+(s+1)+"次"}),l=t.map(function(a){return D(a.score)});n.length===0&&(n=["暂无数据"],l=[null]),y.setOption({grid:{left:36,right:20,top:30,bottom:35},tooltip:{trigger:"axis"},xAxis:{type:"category",boundaryGap:!1,data:n,axisLabel:{color:d.axis}},yAxis:{type:"value",min:0,max:100,axisLabel:{color:d.axis},splitLine:{lineStyle:{color:"rgba(148, 163, 184, 0.22)"}}},series:[{name:"成绩",type:"line",data:l,smooth:!0,symbolSize:8,lineStyle:{color:d.brand,width:3},itemStyle:{color:d.brand},areaStyle:{color:"rgba(45, 142, 232, 0.12)"}}]},!0)}}function ue(e,t){if(_=I(e,_),!!_){var n=Object.keys(t).map(function(a){return{name:Y(a),value:Math.round(G(t[a]))}}).sort(function(a,s){return a.value-s.value}).slice(0,8).reverse(),l=n.length>0;_.setOption({title:l?{show:!1}:{text:"暂无数据",left:"center",top:"middle",textStyle:{color:d.axis,fontSize:14,fontWeight:"normal"}},tooltip:{trigger:"axis",axisPointer:{type:"shadow"},valueFormatter:function(a){return a+"%"}},grid:{left:8,right:40,top:10,bottom:10,containLabel:!0},xAxis:{type:"value",max:100,axisLabel:{color:d.axis,formatter:"{value}%"},splitLine:{lineStyle:{color:d.splitLine}}},yAxis:{type:"category",data:n.map(function(a){return a.name}),axisLabel:{color:d.axis,width:90,overflow:"truncate"}},series:l?[{name:"掌握度",type:"bar",barMaxWidth:22,data:n.map(function(a){var s=a.value>=80?d.mastered:a.value>=60?d.learning:d.weak;return{value:a.value,itemStyle:{color:s,borderRadius:[0,8,8,0]}}}),label:{show:!0,position:"right",formatter:"{c}%",color:d.axis}}]:[]},!0)}}function de(e,t,n){if(x=I(e,x),!!x){var l=n.length>0?n[n.length-1]:null,a=l?D(l.score):0,s=le(t),g=Math.max(0,100-B.value.length*8);x.setOption({tooltip:{},radar:{radius:"62%",indicator:[{name:"最新成绩",max:100},{name:"知识点掌握",max:100},{name:"错题控制",max:100},{name:"稳定性",max:100}],splitArea:{areaStyle:{color:["rgba(45, 142, 232, 0.03)","rgba(45, 142, 232, 0.08)"]}},axisName:{color:d.axis}},series:[{name:"综合能力",type:"radar",data:[{value:[a,s,g,ce(n)],areaStyle:{color:"rgba(52, 199, 193, 0.2)"},lineStyle:{color:d.brandAlt,width:3},itemStyle:{color:d.brandAlt}}]}]},!0)}}function ce(e){if(!e||e.length<2)return 80;var t=e.map(function(a){return D(a.score)}),n=t.reduce(function(a,s){return a+s},0)/t.length,l=t.reduce(function(a,s){return a+Math.pow(s-n,2)},0)/t.length;return Math.max(0,Math.round(100-Math.sqrt(l)))}function X(){y&&y.resize(),_&&_.resize(),x&&x.resize()}function J(){y&&y.dispose(),_&&_.dispose(),x&&x.dispose(),y=null,_=null,x=null}function fe(){if(S.value){var e=document.getElementById("wrong-questions-section");e&&e.scrollIntoView({behavior:"smooth",block:"start"})}}function pe(){var e=document.getElementById("knowledge-section");e&&e.scrollIntoView({behavior:"smooth",block:"start"})}function he(e){ae.push("/teacher/analytics/student/"+e.id)}function ve(){if(!b.value||!p.value)return;const e=b.value.name,t=b.value.studentNo,n=b.value.gender==="male"?"男":"女",l=new Date().toLocaleString();let a="";B.value.forEach(v=>{a+=`
      <tr>
        <td>${v.content||""}</td>
        <td>${v.correctAnswer||""}</td>
        <td>${v.studentAnswer||""}</td>
      </tr>
    `});let s="";if(p.value.scoreTrend&&p.value.scoreTrend.length>0){const v=p.value.scoreTrend.map(f=>f.date?f.date.slice(5,10):""),M=p.value.scoreTrend.map(f=>f.score);s=`
      <table class="info-table">
        <tr>
          <th>时间</th>
          ${v.map(f=>`<th>${f}</th>`).join("")}
        </tr>
        <tr>
          <th>成绩</th>
          ${M.map(f=>`<td>${f}</td>`).join("")}
        </tr>
      </table>
    `}else s="<p>暂无成绩数据</p>";let g="";if(p.value.knowledgePointMastery){const v=Object.entries(p.value.knowledgePointMastery);v.length>0?g=`
        <table class="info-table">
          <tr>
            <th>知识点</th>
            <th>掌握度</th>
          </tr>
          ${v.map(([M,f])=>`
            <tr>
              <td>${Y(M)}</td>
              <td>${typeof f=="object"?f.avgScore+"%":f+"%"}</td>
            </tr>
          `).join("")}
        </table>
      `:g="<p>暂无知识点数据</p>"}else g="<p>暂无知识点数据</p>";const N=`
<!DOCTYPE html>
<html>
<head>
  <title>学生学情报告 - ${e}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      line-height: 1.6;
    }
    h1, h2, h3 {
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .info-table th, .info-table td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
    }
    .info-table th {
      background-color: #f2f2f2;
    }
    .footer {
      margin-top: 50px;
      text-align: center;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>学生学情报告</h1>
    <h2>${e} - ${t}</h2>
    <p>生成时间: ${l}</p>
  </div>
  
  <h3>一、学生基本信息</h3>
  <table class="info-table">
    <tr>
      <th>姓名</th>
      <td>${e}</td>
      <th>学号</th>
      <td>${t}</td>
      <th>性别</th>
      <td>${n}</td>
    </tr>
  </table>
  
  <h3>二、成绩趋势</h3>
  ${s}
  
  <h3>三、知识点掌握情况</h3>
  ${g}
  
  <h3>四、错题列表</h3>
  <table class="info-table">
    <tr>
      <th>题目内容</th>
      <th>正确答案</th>
      <th>学生答案</th>
    </tr>
    ${a}
  </table>
  
  <div class="footer">
    <p>智析数学 · 学情报告</p>
  </div>
</body>
</html>
  `,u=window.open("","_blank","width=800,height=600");u?(u.document.open(),u.document.write(N),u.document.close(),u.onload=function(){setTimeout(function(){u.print(),u.onafterprint=function(){u.close()}},500)}):alert("无法打开打印窗口，请检查浏览器设置")}return(e,t)=>{const n=k("el-option"),l=k("el-select"),a=k("el-input"),s=k("el-table-column"),g=k("el-button"),N=k("el-table"),u=k("el-card"),v=k("el-descriptions-item"),M=k("el-descriptions"),f=xe("loading");return A(),j("div",Ne,[t[12]||(t[12]=c("div",{class:"page-header"},[c("h2",null,"学生学情分析"),c("p",null,"选一个学生，看他的成绩变化、知识点掌握度和错题。")],-1)),o(u,{class:"gradient-card"},{header:r(()=>[c("div",Le,[c("div",Ve,[t[2]||(t[2]=c("span",null,"学生列表",-1)),o(l,{modelValue:h(C),"onUpdate:modelValue":t[0]||(t[0]=i=>Z(C)?C.value=i:C=i),placeholder:"选择班级",onChange:K,style:{width:"200px","margin-left":"20px"}},{default:r(()=>[(A(!0),j(Se,null,Ae(h(q),i=>(A(),L(n,{key:i.id,label:i.name,value:i.id},null,8,["label","value"]))),128))]),_:1},8,["modelValue"])]),o(a,{modelValue:h(T),"onUpdate:modelValue":t[1]||(t[1]=i=>Z(T)?T.value=i:T=i),placeholder:"搜索学生姓名或学号","prefix-icon":"Search",style:{width:"300px"}},null,8,["modelValue"])])]),default:r(()=>[o(N,{data:h(re),style:{width:"100%"}},{default:r(()=>[o(s,{prop:"studentNo",label:"学号",width:"120"}),o(s,{prop:"name",label:"姓名"}),o(s,{prop:"gender",label:"性别",width:"80"},{default:r(i=>[m(R(i.row.gender==="male"?"男":"女"),1)]),_:1}),o(s,{label:"操作",width:"120"},{default:r(i=>[o(g,{type:"primary",link:"",onClick:Oe=>he(i.row)},{default:r(()=>[...t[3]||(t[3]=[m(" 学情分析 ",-1)])]),_:1},8,["onClick"])]),_:1})]),_:1},8,["data"])]),_:1}),h(S)?_e((A(),L(u,{key:0,class:"gradient-card analytics-card"},{header:r(()=>[c("div",Re,[c("div",Ee,[t[6]||(t[6]=c("span",{class:"toolbar-title"},"学生信息",-1)),o(g,{type:"success",plain:"",onClick:fe},{default:r(()=>[...t[4]||(t[4]=[m("查看错题本",-1)])]),_:1}),o(g,{type:"warning",plain:"",onClick:pe},{default:r(()=>[...t[5]||(t[5]=[m("知识点掌握",-1)])]),_:1})]),o(g,{class:"toolbar-export",type:"primary",onClick:ve},{default:r(()=>[...t[7]||(t[7]=[m("导出学情报告",-1)])]),_:1})])]),default:r(()=>[h(b)?(A(),L(M,{key:0,column:3,border:""},{default:r(()=>[o(v,{label:"姓名"},{default:r(()=>[m(R(h(b).name),1)]),_:1}),o(v,{label:"学号"},{default:r(()=>[m(R(h(b).studentNo),1)]),_:1}),o(v,{label:"性别"},{default:r(()=>[m(R(h(b).gender==="male"?"男":"女"),1)]),_:1})]),_:1})):V("",!0)]),_:1})),[[f,h(E)]]):V("",!0),h(S)?(A(),j("div",ze,[c("div",Be,[o(u,{class:"gradient-card chart-card"},{header:r(()=>[...t[8]||(t[8]=[m("成绩趋势",-1)])]),default:r(()=>[c("div",{ref_key:"scoreChartRef",ref:F,class:"chart-container"},null,512)]),_:1})]),c("div",De,[o(u,{class:"gradient-card chart-card",id:"knowledge-section"},{header:r(()=>[...t[9]||(t[9]=[m("知识点掌握度",-1)])]),default:r(()=>[c("div",{ref_key:"knowledgeChartRef",ref:Q,class:"chart-container"},null,512)]),_:1})]),c("div",Ie,[o(u,{class:"gradient-card chart-card"},{header:r(()=>[...t[10]||(t[10]=[m("综合能力雷达",-1)])]),default:r(()=>[c("div",{ref_key:"levelChartRef",ref:W,class:"chart-container"},null,512)]),_:1})])])):V("",!0),h(S)?(A(),L(u,{key:2,id:"wrong-questions-section",class:"gradient-card wrong-section-card"},{header:r(()=>[...t[11]||(t[11]=[m("错题列表",-1)])]),default:r(()=>[o(N,{data:h(B),"max-height":"400",class:"safe-table wrong-table"},{default:r(()=>[o(s,{prop:"content",label:"题目内容","min-width":"260"},{default:r(i=>[o(P,{class:"question-content",text:i.row.content},null,8,["text"])]),_:1}),o(s,{prop:"correctAnswer",label:"正确答案","min-width":"200"},{default:r(i=>[o(P,{class:"answer-text",text:i.row.correctAnswer},null,8,["text"])]),_:1}),o(s,{prop:"studentAnswer",label:"学生答案","min-width":"200"},{default:r(i=>[o(P,{class:"answer-text",text:i.row.studentAnswer},null,8,["text"])]),_:1})]),_:1},8,["data"])]),_:1})):V("",!0)])}}},Xe=Me(Pe,[["__scopeId","data-v-43f41b26"]]);export{Xe as default};
