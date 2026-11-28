/* Accessible, bilingual renderer for the optional self-contained reference sheet. */
(() => {
  "use strict";
  const source = document.getElementById("seance");
  if (!source) return;
  let data;
  try { data = JSON.parse(source.textContent); } catch { return; }
  const sheet = data.fiche;
  if (!sheet || sheet.statut !== "prete") return;

  const lang = document.documentElement.lang === "en" ? "en" : "fr";
  const copy = lang === "en" ? {
    modeSteps:"Guided pathway", modeSheet:"Self-contained sheet", kicker:"REFERENCE SHEET",
    notice:"Editorial prototype. The structure and examples are technically checked; an independent actuarial review and learner testing have not yet been completed.",
    tabs:["Overview","Complete course","Methods","Worked examples","Solved exercises","Applications & labs","Summary & references"],
    question:"Guiding question", why:"Why it matters", objectives:"Learning objectives", prerequisites:"Prerequisites",
    map:"Learning map", duration:"Estimated study time", formulas:"Key formula", when:"When to use",
    steps:"Procedure", checks:"Consistency checks", errors:"Common mistakes", statement:"Problem",
    reasoning:"Reasoning", result:"Result", interpretation:"Interpretation", inputs:"Inputs",
    assumptions:"Assumptions", procedure:"Procedure", outputs:"Outputs", validation:"Validation",
    limits:"Limitations", memo:"Key takeaways", glossary:"Bilingual glossary", mastery:"Mastery checklist",
    references:"Annotated references", tools:"Tools", context:"Context", goal:"Goal",
    feedback:"Learning feedback", solution:"Worked solution", completed:"Items reviewed"
  } : {
    modeSteps:"Parcours guidé", modeSheet:"Fiche autonome", kicker:"FICHE DE RÉFÉRENCE",
    notice:"Prototype éditorial. La structure et les exemples sont vérifiés techniquement ; une revue actuarielle indépendante et des tests auprès d'apprenants restent à effectuer.",
    tabs:["Vue d'ensemble","Cours complet","Méthodes","Exemples guidés","Exercices corrigés","Applications & labs","Synthèse & références"],
    question:"Question directrice", why:"Pourquoi c'est important", objectives:"Objectifs d'apprentissage", prerequisites:"Prérequis",
    map:"Carte des notions", duration:"Temps estimé", formulas:"Formule essentielle", when:"Quand l'utiliser",
    steps:"Procédure", checks:"Contrôles de cohérence", errors:"Erreurs fréquentes", statement:"Énoncé",
    reasoning:"Raisonnement", result:"Résultat", interpretation:"Interprétation", inputs:"Entrées",
    assumptions:"Hypothèses", procedure:"Procédure", outputs:"Sorties", validation:"Validation",
    limits:"Limites", memo:"À retenir", glossary:"Glossaire bilingue", mastery:"Checklist de maîtrise",
    references:"Références annotées", tools:"Outils", context:"Contexte", goal:"Objectif",
    feedback:"Retour pédagogique", solution:"Corrigé détaillé", completed:"Éléments relus"
  };
  const $ = (selector, root=document) => root.querySelector(selector);
  const make = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const list = (items, ordered=false) => {
    const node = document.createElement(ordered ? "ol" : "ul");
    (items || []).forEach(item => {
      const source = typeof item === "string" ? item.trim() : "";
      const lines = source.split(/\r?\n/);
      const fenced = lines.length >= 3 && lines[0].startsWith("```") && lines[lines.length - 1] === "```";
      if (fenced) {
        const entry = make("li","reference-code-item");
        const pre = make("pre","reference-code");
        pre.append(make("code","",lines.slice(1,-1).join("\n")));
        entry.append(pre);
        node.append(entry);
      } else {
        node.append(make("li","",item));
      }
    });
    return node;
  };
  const block = (title, content) => {
    const node = make("section","reference-block");
    if (title) node.append(make("h3","",title));
    if (content) node.append(content);
    return node;
  };
      // Auto-wrap equation-like fragments in all ordinary text nodes, across every content component.
  const BARE_MATH = /(?<![\p{L}\d_])(?:[A-Za-zδΔ][\p{L}\d_{}]*|\d+(?:[.,]\d+)?)(?:\s*(?:=|<|>|≤|≥|≈|≠|\+|−|×|÷|\/|\^)\s*(?:[A-Za-zδΔ][\p{L}\d_{}]*|\d+(?:[.,]\d+)?|\([^)]*\)))+/gu;
  function inlineNotation(value) {
    return String(value ?? "").split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).map((part,index) => {
      if (index % 2 === 1) return part;
      return part.replace(BARE_MATH, (match) => "$" + match.trim() + "$");
    }).join("");
  }
  function prepareMathText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      if (node.parentElement?.closest("code, pre, script, style, kbd, .katex, .math-rendered")) continue;
      nodes.push(node);
    }
    nodes.forEach(node => {
      const text = inlineNotation(node.nodeValue);
      if (text === node.nodeValue) return;
      const span = document.createElement("span");
      span.className = "math-notation-source";
      span.textContent = text;
      node.replaceWith(span);
    });
  }
const paragraph = (text) => make("p","",inlineNotation(text));
  const formula = (text) => {
    const node = make("div","reference-formula");
    node.setAttribute("aria-label", text);
    if (window.katex) katex.render(text, node, {displayMode:true, throwOnError:false, strict:"ignore"});
    else node.textContent = text;
    return node;
  };
  const renderMath = (root) => {
    prepareMathText(root);
    if (window.renderMathInElement) {
      window.renderMathInElement(root,{
        delimiters:[{left:"\\[",right:"\\]",display:true},{left:"\\(",right:"\\)",display:false},{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}],
        throwOnError:false
      });
    }
  };
  const panelNodes = [];
  const renderers = [
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[0]));
      root.append(block(copy.question,paragraph(data.question)));
      root.append(block(copy.why,paragraph(data.pourquoi)));
      const grid=make("div","reference-grid");
      grid.append(block(copy.objectives,list(data.objectifs,true)));
      grid.append(block(copy.prerequisites,list(data.prerequis)));
      root.append(grid,block(copy.map,list(data.carte)));
      root.append(block(copy.duration,paragraph(data.duree_minutes+" min")));
      return root;
    },
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[1]));
      (data.sections||[]).forEach(section=>{
        const node=block(section.titre,paragraph(section.contenu));
        (section.formules||[]).forEach(item=>{
          node.append(formula(item.formule),paragraph(item.explication));
        });
        root.append(node);
      });
      return root;
    },
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[2]));
      (data.methodes||[]).forEach(method=>{
        const node=block(method.titre,paragraph(method.quand_utiliser));
        node.append(make("h3","",copy.steps),list(method.etapes,true));
        node.append(make("h3","",copy.checks),list(method.controles));
        node.append(make("h3","",copy.errors),list(method.erreurs));
        root.append(node);
      });
      return root;
    },
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[3]));
      (data.exemples||[]).forEach(example=>{
        const node=block(example.titre,paragraph(example.enonce));
        node.append(make("h3","",copy.reasoning),list(example.raisonnement,true));
        node.append(make("p","reference-result",example.resultat));
        node.append(make("h3","",copy.interpretation),paragraph(example.interpretation));
        node.append(make("h3","",copy.checks),list(example.controles));
        root.append(node);
      });
      return root;
    },
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[4]));
      (data.exercices||[]).forEach(exercise=>{
        const node=block(exercise.titre,paragraph(exercise.enonce));
        const level=make("span","eyebrow",exercise.niveau);
        node.append(level,make("h3","",copy.solution),list(exercise.corrige,true));
        node.append(make("h3","",copy.feedback),paragraph(exercise.feedback));
        root.append(node);
      });
      return root;
    },
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[5]));
      (data.applications||[]).forEach(app=>{
        const node=block(app.titre,paragraph(app.contexte));
        node.append(make("h3","",copy.goal),paragraph(app.objectif));
        const tools=make("div","reference-tools");
        (app.outils||[]).forEach(tool=>tools.append(make("span","",tool.toUpperCase())));
        node.append(make("h3","",copy.tools),tools);
        for (const [key,label] of [["entrees",copy.inputs],["hypotheses",copy.assumptions],["procedure",copy.procedure],["sorties",copy.outputs],["validation",copy.validation],["limites",copy.limits]]) {
          node.append(make("h3","",label),list(app[key],key==="procedure"));
        }
        root.append(node);
      });
      return root;
    },
    (data) => {
      const root=make("div","reference-panel");
      root.append(make("h2","",copy.tabs[6]));
      root.append(block(copy.memo,list(data.memo)));
      const table=make("table","reference-table");
      const head=make("thead");
      const row=make("tr");
      [lang==="en"?"French term":"Terme français",lang==="en"?"English term":"Terme anglais",lang==="en"?"Definition":"Définition"].forEach(x=>row.append(make("th","",x)));
      head.append(row);table.append(head);
      const body=make("tbody");
      (data.glossaire||[]).forEach(term=>{
        const tr=make("tr");
        [term.terme_fr,term.terme_en,term.definition].forEach(value=>tr.append(make("td","",value)));
        body.append(tr);
      });
      table.append(body);root.append(block(copy.glossary,table));
      const checklist=make("div","reference-check");
      (data.maitrise||[]).forEach((item,index)=>{
        const label=make("label","");
        const input=make("input","");
        input.type="checkbox";input.id="reference-check-"+index;
        label.append(input,make("span","",item));checklist.append(label);
      });
      root.append(block(copy.mastery,checklist));
      (data.references||[]).forEach(ref=>{
        const content=make("div","reference-reference");
        content.append(make("p","",ref.titre),paragraph(ref.detail));
        if(ref.url){
          try{
            const url=new URL(ref.url);
            if(url.protocol==="https:" && !url.username && !url.password){
              const a=make("a","",ref.url);a.href=url.href;a.target="_blank";a.rel="noopener noreferrer";
              content.append(a);
            }
          }catch{}
        }
        root.append(block(copy.references,content));
      });
      (data.liens||[]).forEach(link=>{
        // Translation overlays may translate labels, but must retain navigation targets.
        if(typeof link.cible!=="string" || !link.cible.includes("/") || typeof data.id!=="string") return;
        const a=make("a","reference-link",link.titre);
        const [target,anchor] = link.cible.split("#");
        const [targetDomain,targetSession] = target.split("/");
        const currentDomain = data.id.split("/")[0];
        const relative = targetDomain === currentDomain ? "../"+targetSession+"/index.html" : "../../"+targetDomain+"/"+targetSession+"/index.html";
        a.href=relative+(anchor?"#"+anchor:"");
        root.append(a);
      });
      return root;
    }
  ];
  const switcher=$("#lesson-mode"), steps=$("#lesson-pathway"), sheetNode=$("#reference-sheet");
  const tabs=$("#reference-tabs"), panels=$("#reference-panels");
  if(!switcher||!steps||!sheetNode||!tabs||!panels) return;
  switcher.hidden=false;
  $("#mode-steps").textContent=copy.modeSteps;
  $("#mode-reference").textContent=copy.modeSheet;
  $("#reference-kicker").textContent=copy.kicker;
  $("#reference-title").textContent=data.titre;
  $("#reference-notice").textContent=copy.notice;
  $("#reference-notice").className="reference-notice";

  const keys=["vue_ensemble","cours_complet","methodes","exemples_guides","exercices_corriges","applications_labs","synthese_references"];
  const tabButtons=[];
  keys.forEach((key,index)=>{
    const tab=make("button","",copy.tabs[index]);
    tab.type="button";tab.id="reference-tab-"+index;tab.setAttribute("role","tab");
    tab.setAttribute("aria-controls","reference-panel-"+index);
    tab.setAttribute("aria-selected",index===0?"true":"false");
    tab.tabIndex=index===0?0:-1;
    const panel=renderers[index](sheet[key]);
    panel.id="reference-panel-"+index;panel.setAttribute("role","tabpanel");
    panel.setAttribute("aria-labelledby",tab.id);panel.tabIndex=0;panel.hidden=index!==0;
    tab.addEventListener("click",()=>activate(index,true));
    tabs.append(tab);panels.append(panel);tabButtons.push(tab);panelNodes.push(panel);
  });
  let activeIndex=0;
  function activate(index,focus){
    activeIndex=index;
    tabButtons.forEach((tab,i)=>{
      tab.setAttribute("aria-selected",i===index?"true":"false");
      tab.tabIndex=i===index?0:-1;
      panelNodes[i].hidden=i!==index;
    });
    if(focus)tabButtons[index].focus();
    renderMath(panelNodes[index]);
  }
  tabs.addEventListener("keydown",event=>{
    const current=tabButtons.indexOf(document.activeElement);
    if(current<0)return;
    let next=current;
    if(event.key==="ArrowRight")next=(current+1)%tabButtons.length;
    else if(event.key==="ArrowLeft")next=(current-1+tabButtons.length)%tabButtons.length;
    else if(event.key==="Home")next=0;
    else if(event.key==="End")next=tabButtons.length-1;
    else return;
    event.preventDefault();activate(next,true);
  });
  function mode(reference){
    steps.hidden=reference;sheetNode.hidden=!reference;
    $("#mode-steps").setAttribute("aria-pressed",reference?"false":"true");
    $("#mode-reference").setAttribute("aria-pressed",reference?"true":"false");
    if(reference){
      // Reassert the selected tab when returning to reference mode. This prevents
      // a hidden panel from leaving the sheet blank after a mode transition.
      panelNodes.forEach((panel,index)=>{panel.hidden=index!==activeIndex;});
      renderMath(panelNodes[activeIndex]);
    }
  }
  $("#mode-steps").addEventListener("click",()=>mode(false));
  $("#mode-reference").addEventListener("click",()=>mode(true));
  renderMath(panelNodes[0]);
})();
