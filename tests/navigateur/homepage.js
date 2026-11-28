// Responsive and bilingual smoke test for the learner-first homepage.
const { chromium } = require("playwright");
const BASE = process.env.SITE_URL || "http://localhost:8765/";

(async () => {
  let browser;
  const failures = [];
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(new URL("index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    await page.locator(".hero-visual").waitFor();
    const shortLabels = await page.locator(".dom-t").allInnerTexts();
    if (!shortLabels.length || shortLabels.some((label) => label.trim().length > 18)) failures.push("homepage domain labels should stay concise");
    await page.waitForFunction(() => Array.from(document.querySelectorAll(".brand-logo")).some((img) => img.complete && img.naturalWidth > 0), null, { timeout: 15000 });
    const notationCheck = await page.evaluate(() => {
      const node = document.createElement("p");
      node.textContent = "Notation : c_t et x = y; inline \\(i^{(m)}\\), display \\[1 + i = y\\].";
      document.body.append(node);
      window.renderActuarialMath(node);
      return { rendered: node.querySelectorAll(".katex").length, source: node.textContent };
    });
    console.log("global notation check:", notationCheck);
    if (notationCheck.rendered < 4) failures.push("global KaTeX should render indexed variables, bare equations, inline delimiters and display delimiters outside lesson components");

    const brand = await page.evaluate(() => ({
      title: document.title,
      label: document.querySelector(".brand-copy")?.textContent || "",
      logoCount: document.querySelectorAll(".brand").length,
      eachBrandHasOneMark: Array.from(document.querySelectorAll(".brand")).every((brand) => brand.querySelectorAll(".brand-logo").length === 1),
      logoSrc: document.querySelector(".brand-logo")?.src || "",
      logoLoaded: Array.from(document.querySelectorAll(".brand-logo")).every((img) => img.complete && img.naturalWidth > 0)
    }));
    console.log("brand FR:", brand);
    if (!brand.title.startsWith("Laboratoire d’apprentissage actuariel par ACTU-BASICS")) failures.push("French site title");
    if (!brand.label.includes("LABORATOIRE ACTUARIEL") || !brand.label.includes("PAR ACTU-BASICS")) failures.push("French sub-brand lockup");
    if (!brand.logoLoaded) failures.push("custom Actuarial Learning Lab mark did not load");
    if (!brand.eachBrandHasOneMark) failures.push("each brand lockup should contain exactly one mark image");
    if (!brand.logoSrc.includes("/assets/actuarial-lab-mark.svg")) failures.push("English homepage logo should resolve to the site-root asset path");
    const mobile = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      domains: document.querySelectorAll(".doms .dom").length,
      sessions: JSON.parse(document.getElementById("plan").textContent).length,
      stat: document.querySelector(".home-stat strong").textContent,
      resume: Boolean(document.querySelector("[data-reprendre]"))
    }));
    console.log("mobile FR:", mobile);
    if (mobile.lang !== "fr") failures.push("French homepage language");
    if (mobile.scrollWidth > mobile.width + 1) failures.push("mobile horizontal overflow");
    if (mobile.domains !== 7) failures.push("domain cards");
    if (Number(mobile.stat) !== mobile.sessions) failures.push("session count is not data-driven");
    if (!mobile.resume) failures.push("resume action missing");

    // Homepage mini-lab: controls must recalculate real outputs and render a chart in both languages.
    await page.locator("#mini-lab").waitFor();
    const miniDefaults = await page.evaluate(() => ({
      capital: document.querySelector("#mini-capital-label")?.textContent,
      rate: document.querySelector("#mini-rate-label")?.textContent,
      years: document.querySelector("#mini-years-label")?.textContent,
      future: document.querySelector("#mini-future")?.textContent,
      summary: document.querySelector("#mini-chart-summary")?.textContent,
      canvas: document.querySelector("#mini-growth")?.width > 0
    }));
    console.log("mini-lab defaults FR:", miniDefaults);
    if (!miniDefaults.future || !miniDefaults.summary || !miniDefaults.canvas) failures.push("mini-lab initial outputs/chart missing");
    await page.locator("#mini-capital").evaluate((el) => { el.value = "4000"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.locator("#mini-rate").evaluate((el) => { el.value = "5"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.locator("#mini-years").evaluate((el) => { el.value = "10"; el.dispatchEvent(new Event("input", { bubbles: true })); });
    const miniChanged = await page.evaluate(() => ({
      future: document.querySelector("#mini-future")?.textContent,
      interest: document.querySelector("#mini-interest")?.textContent,
      factor: document.querySelector("#mini-factor")?.textContent,
      summary: document.querySelector("#mini-chart-summary")?.textContent
    }));
    console.log("mini-lab changed FR:", miniChanged);
    const expected = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(4000 * Math.pow(1.05, 10));
    if (miniChanged.future !== expected) failures.push("mini-lab future value calculation");
    if (!miniChanged.interest || !miniChanged.factor || !miniChanged.summary.includes("10 ans")) failures.push("mini-lab updated metrics/summary");


    // Verify local progress changes the primary action without requiring an account.
    await page.evaluate(() => {
      const plan = JSON.parse(document.getElementById("plan").textContent);
      localStorage.setItem("parcours:" + plan[0].s + ":etapes", JSON.stringify({ "0": true }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const resumeText = await page.locator("[data-reprendre]").textContent();
    console.log("resume after local progress:", resumeText);
    if (!/Reprendre/.test(resumeText)) failures.push("local resume state");

    // Language switching must preserve the responsive homepage structure.
    await page.locator('a[data-langue="en"]').click();
    await page.waitForFunction(() => document.documentElement.lang === "en");
    const englishMobile = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      title: document.querySelector(".home-intro h2").textContent,
      siteTitle: document.title,
      brand: document.querySelector(".brand-copy")?.textContent || ""
    }));
    console.log("mobile EN:", englishMobile);
    const shortLabelsEN = await page.locator(".dom-t").allInnerTexts();
    if (!shortLabelsEN.length || shortLabelsEN.some((label) => label.trim().length > 18)) failures.push("English homepage domain labels should stay concise");
    if (englishMobile.lang !== "en") failures.push("English homepage language");
    if (englishMobile.scrollWidth > englishMobile.width + 1) failures.push("English mobile horizontal overflow");
    if (!/Understand the idea/.test(englishMobile.title)) failures.push("English editorial content");
    if (!englishMobile.siteTitle.startsWith("Actuarial Learning Lab by ACTU-BASICS")) failures.push("English site title");
    if (!englishMobile.brand.includes("ACTUARIAL LEARNING LAB") || !englishMobile.brand.includes("BY ACTU-BASICS")) failures.push("English sub-brand lockup");
    const footerLogoEN = await page.locator(".pied .brand-logo").evaluate((img) => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }));
    if (!footerLogoEN.loaded || !footerLogoEN.src.includes("/assets/actuarial-lab-mark.svg")) failures.push("English homepage footer logo must load from the site-root asset path");
    const miniEnglish = await page.evaluate(() => ({
      title: document.querySelector("#mini-lab h2")?.textContent,
      summary: document.querySelector("#mini-chart-summary")?.textContent,
      rateLabel: document.querySelector("#mini-rate-label")?.textContent
    }));
    if (!/compound interest/i.test(miniEnglish.title || "")) failures.push("English mini-lab title");
    if (!/years/.test(miniEnglish.summary || "")) failures.push("English mini-lab chart summary");
    if (!miniEnglish.rateLabel.includes("%")) failures.push("English mini-lab rate formatting");

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktop = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      heroColumns: getComputedStyle(document.querySelector(".hero-in")).gridTemplateColumns,
      offenders: Array.from(document.querySelectorAll("body *")).map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, className: typeof el.className === "string" ? el.className : "", text: (el.textContent || "").trim().slice(0, 35), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), display: getComputedStyle(el).display };
      }).filter((x) => x.display !== "none" && (x.right > window.innerWidth + 1 || x.left < -1)).sort((a, b) => b.right - a.right).slice(0, 12)
    }));
    console.log("desktop EN:", desktop);
    if (desktop.scrollWidth > desktop.width + 1) failures.push("desktop horizontal overflow");
    // The shared quiz renderer must separate each option letter from its text in both locales.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(new URL("a1/s01/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    await page.locator(".opt").first().waitFor();
    const frenchOptions = await page.locator(".opt").allInnerTexts();
    console.log("quiz options FR:", frenchOptions);
    if (!frenchOptions.length || !frenchOptions.every((value) => /^[A-Z]\s+(?!-)/.test(value.trim()))) failures.push("French quiz options should use letter enumeration without a dash");
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push("session mobile horizontal overflow");

    await page.goto(new URL("en/a1/s01/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    await page.locator(".opt").first().waitFor();
    const englishLessonLogo = await page.locator(".brand-logo").evaluate((img) => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }));
    if (!englishLessonLogo.loaded || !englishLessonLogo.src.includes("/assets/actuarial-lab-mark.svg")) failures.push("English lesson header logo must load from the site-root asset path");
    const englishOptions = await page.locator(".opt").allInnerTexts();
    console.log("quiz options EN:", englishOptions);
    if (!englishOptions.length || !englishOptions.every((value) => /^[A-Z]\s+(?!-)/.test(value.trim()))) failures.push("English quiz options should use letter enumeration without a dash");

    await page.goto(new URL("en/a1/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    const nestedFooterLogo = await page.locator(".pied .brand-logo").evaluate((img) => ({ src: img.src, loaded: img.complete && img.naturalWidth > 0 }));
    if (!nestedFooterLogo.loaded || !nestedFooterLogo.src.includes("/assets/actuarial-lab-mark.svg")) failures.push("English nested-page footer logo must load from the site-root asset path");


    // Wide lesson workspace: the progress rail stays visible and the canvas uses the available desktop width.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(new URL("a1/s01/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    await page.locator(".lesson-shell").waitFor();
    const lessonDesktop = await page.evaluate(() => ({
      columns: getComputedStyle(document.querySelector(".lesson-shell")).gridTemplateColumns,
      rail: document.querySelector(".lesson-rail")?.getBoundingClientRect().width || 0,
      canvas: document.querySelector(".stage")?.getBoundingClientRect().width || 0,
      labels: document.querySelectorAll(".rail-step-name").length,
      overflow: document.documentElement.scrollWidth > window.innerWidth
    }));
    console.log("lesson desktop:", lessonDesktop);
    if (lessonDesktop.rail < 180 || lessonDesktop.canvas < 800) failures.push("desktop lesson workspace does not use available width");
    if (!lessonDesktop.labels) failures.push("desktop lesson step labels missing");
    if (lessonDesktop.overflow) failures.push("desktop lesson horizontal overflow");

    await page.setViewportSize({ width: 390, height: 844 });
    const lessonMobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      rail: getComputedStyle(document.querySelector(".lesson-rail")).position,
      namesHidden: Array.from(document.querySelectorAll(".rail-step-name")).every((el) => getComputedStyle(el).display === "none")
    }));
    console.log("lesson mobile:", lessonMobile);
    if (lessonMobile.overflow) failures.push("lesson mobile horizontal overflow");

    // A formula is presented as a deliberate dark mathematical studio board, not a generic white card.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(new URL("a1/s01/index.html#etape-3", BASE).toString(), { waitUntil: "domcontentloaded" });
    await page.locator(".formula").first().waitFor();
    const board = await page.locator(".formula").first().evaluate((el) => ({
      background: getComputedStyle(el).backgroundImage,
      color: getComputedStyle(el).color,
      accent: getComputedStyle(el, "::before").backgroundImage
    }));
    console.log("mathematical board:", board);
    if (!board.background.includes("radial-gradient") || !board.background.includes("linear-gradient")) failures.push("formula should use the mathematical studio board treatment");
    if (board.color !== "rgb(237, 244, 251)") failures.push("formula foreground contrast color missing");
    if (!board.accent.includes("linear-gradient")) failures.push("formula accent line missing");


    // Mobile header, dropdown placement and account-page width at common phone sizes.
    for (const width of [320, 360, 375, 390, 414, 430, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(new URL("compte/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator(".nav-in").waitFor();
      const header = await page.evaluate(() => {
        const box = (selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width };
        };
        return {
          width: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          header: box(".nav-in"),
          brand: box(".brand"),
          menu: box(".nav-menu"),
          language: box(".langs"),
          account: box(".nav .acct"),
          content: box(".compte")
        };
      });
      console.log("account header viewport:", header);
      if (header.scrollWidth > width + 1) failures.push("account page horizontal overflow at " + width + "px");
      for (const key of ["header", "brand", "menu", "language", "account", "content"]) {
        const item = header[key];
        if (item && (item.left < -1 || item.right > width + 1)) failures.push(key + " escapes viewport at " + width + "px");
      }
      await page.locator(".nav-menu summary").click();
      await page.waitForFunction(() => document.querySelector(".nav-menu summary")?.getAttribute("aria-expanded") === "true");
      const dropdown = await page.locator(".nav-sheet").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height, expanded: el.closest("details").open, ariaExpanded: el.closest("details").querySelector("summary").getAttribute("aria-expanded") };
      });
      console.log("mobile menu viewport:", width, dropdown);
      if (dropdown.left < -1 || dropdown.right > width + 1) failures.push("mobile menu is clipped at " + width + "px");
      if (!dropdown.expanded || dropdown.ariaExpanded !== "true") failures.push("mobile menu expanded state is not announced at " + width + "px");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector(".nav-menu summary")?.getAttribute("aria-expanded") === "false");
      if (await page.locator(".nav-menu").evaluate((el) => el.open)) failures.push("Escape does not close mobile menu at " + width + "px");
      if (await page.locator(".nav-menu summary").evaluate((el) => document.activeElement !== el)) failures.push("Escape does not restore menu focus at " + width + "px");
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(new URL("compte/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push("account page mobile horizontal overflow");


    // Self-contained reference sheet: seven tabs, bilingual parity and phone/tablet layout.
    for (const language of ["fr", "en"]) {
      const lessonPath = language === "en" ? "en/a1/s01/index.html" : "a1/s01/index.html";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(new URL(lessonPath, BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-mode").waitFor({ state: "visible" });
      const tabs = page.locator("#reference-tabs [role=tab]");
      if (await tabs.count() !== 7) failures.push(language + " reference sheet should expose seven tabs");
      if (await page.locator("#reference-panel-0").isVisible() !== false) failures.push("reference sheet should not replace the guided pathway by default");
      await page.locator("#mode-reference").click();
      if (!(await page.locator("#reference-panel-0").isVisible())) failures.push(language + " overview tab should be visible");
      const titles = await tabs.allTextContents();
      console.log("reference sheet tabs:", language, titles);
      if (language === "fr" && !titles[0].includes("Vue")) failures.push("French tab labels missing");
      if (language === "en" && !titles[1].includes("Complete")) failures.push("English tab labels missing");
      await tabs.nth(1).click();
      await page.locator("#reference-panel-1").waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelectorAll("#reference-panel-1 .katex").length > 0);
      if (!(await page.locator("#reference-panel-1 .reference-block").count())) failures.push(language + " complete course has no sections");
      if (!(await page.locator("#reference-panel-1 .reference-formula .katex-display").count())) failures.push(language + " display formulas should use proper fraction/exponent layout");
      await tabs.nth(2).click();
      await page.locator("#reference-panel-2").waitFor({ state: "visible" });
      if (!(await page.locator("#reference-panel-2 .katex").count())) failures.push(language + " inline mathematical notation should be typeset in methods");
      await tabs.nth(1).focus();
      await page.keyboard.press("ArrowRight");
      await page.waitForFunction(() => document.querySelector("#reference-tab-2")?.getAttribute("aria-selected") === "true");
      if (!(await page.locator("#reference-panel-2").isVisible())) failures.push(language + " tab keyboard navigation did not activate methods");
      await tabs.nth(5).click();
      const labCode = await page.locator("#reference-panel-5 pre.reference-code code").textContent();
      if (!labCode || !labCode.includes("1274.45")) failures.push(language + " lab should expose the complete Python calculation");
      for (const width of [320, 375, 430, 768]) {
        await page.setViewportSize({ width, height: 844 });
        const metrics = await page.evaluate(() => ({
          viewport: window.innerWidth,
          document: document.documentElement.scrollWidth,
          shell: document.querySelector(".lesson-shell").getBoundingClientRect().width,
          lessonContent: document.querySelector(".lesson-content").getBoundingClientRect().width,
          sheet: document.querySelector("#reference-sheet").getBoundingClientRect().width,
          tabs: document.querySelector("#reference-tabs").scrollWidth,
          tabsClient: document.querySelector("#reference-tabs").clientWidth
        }));
        console.log("reference sheet viewport:", language, metrics);
        if (metrics.document > width + 1) failures.push(language + " reference sheet horizontal overflow at " + width + "px");
      }
      await page.locator("#mode-steps").click();
      if (!(await page.locator("#stage").isVisible())) failures.push(language + " guided pathway should be restored");
    }
    // A2/S04 reference sheet: pooling, LLN, CLT and systematic risk.
    for (const language of ["fr", "en"]) {
      const path = language === "en" ? "en/a2/s04/index.html" : "a2/s04/index.html";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(new URL(path, BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-mode").waitFor({ state: "visible" });
      await page.locator("#mode-reference").click();
      await page.waitForFunction(() => {
        const sheet = document.querySelector("#reference-sheet");
        const panel = document.querySelector("#reference-panel-0");
        return sheet && !sheet.hidden && panel && !panel.hidden;
      }, null, { timeout: 5000 }).catch(async () => {
        const state = await page.evaluate(() => ({
          sheetHidden: document.querySelector("#reference-sheet")?.hidden,
          panelHidden: document.querySelector("#reference-panel-0")?.hidden,
          tabs: document.querySelectorAll("#reference-tabs [role=tab]").length
        }));
        console.error("A2/S04 reference-mode diagnostic:", language, state, errors);
        failures.push(language + " A2/S04 reference mode failed to expose overview");
      });
      const tabs = page.locator("#reference-tabs [role=tab]");
      if (await tabs.count() !== 7) failures.push(language + " A2/S04 should have seven tabs");
      await tabs.nth(1).click();
      if (!(await page.locator("#reference-panel-1 .reference-formula .katex-display").count())) failures.push(language + " A2/S04 display formulas should render");
      await tabs.nth(2).click();
      if (!(await page.locator("#reference-panel-2 .katex").count())) failures.push(language + " A2/S04 inline method formulas should render");
      const inlineCount = await page.locator("#reference-panel-2 .reference-block li .katex").count();
      const displayCount = await page.locator("#reference-panel-2 .reference-block li .katex-display").count();
      if (!inlineCount) failures.push(language + " A2/S04 inline formulas should remain inside method lists");
      if (displayCount) failures.push(language + " A2/S04 inline formulas must not become display math");
      await tabs.nth(3).click();
      if (!(await page.locator("#reference-panel-3 .reference-block").count())) failures.push(language + " A2/S04 worked examples missing");
      await tabs.nth(4).click();
      if (!(await page.locator("#reference-panel-4 .reference-block").count())) failures.push(language + " A2/S04 solved exercises missing");
      await tabs.nth(5).click();
      if (!(await page.locator("#reference-panel-5 pre.reference-code code").count())) failures.push(language + " A2/S04 pooling lab code missing");
      await tabs.nth(6).click();
      if (!(await page.locator("#reference-panel-6 .reference-table").count())) failures.push(language + " A2/S04 glossary missing");
      await page.setViewportSize({ width: 320, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(language + " A2/S04 reference sheet overflow at 320px");
    }

    // A2/S03 reference sheet: continuous severity and tail risk.
    for (const language of ["fr", "en"]) {
      const path = language === "en" ? "en/a2/s03/index.html" : "a2/s03/index.html";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(new URL(path, BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-mode").waitFor({ state: "visible" });
      await page.locator("#mode-reference").click();
      await page.waitForFunction(() => {
        const sheet = document.querySelector("#reference-sheet");
        const panel = document.querySelector("#reference-panel-0");
        return sheet && !sheet.hidden && panel && !panel.hidden;
      }, null, { timeout: 5000 }).catch(async () => {
        const state = await page.evaluate(() => ({
          sheetHidden: document.querySelector("#reference-sheet")?.hidden,
          panelHidden: document.querySelector("#reference-panel-0")?.hidden,
          tabs: document.querySelectorAll("#reference-tabs [role=tab]").length
        }));
        console.error("A2/S03 reference-mode diagnostic:", language, state, errors);
        failures.push(language + " A2/S03 reference mode failed to expose overview");
      });
      const tabs = page.locator("#reference-tabs [role=tab]");
      if (await tabs.count() !== 7) failures.push(language + " A2/S03 should have seven tabs");
      await tabs.nth(1).click();
      if (!(await page.locator("#reference-panel-1 .reference-formula .katex-display").count())) failures.push(language + " A2/S03 display formulas should render");
      await tabs.nth(2).click();
      if (!(await page.locator("#reference-panel-2 .katex").count())) failures.push(language + " A2/S03 inline method formulas should render");
      const inlineCount = await page.locator("#reference-panel-2 .reference-block li .katex").count();
      const displayCount = await page.locator("#reference-panel-2 .reference-block li .katex-display").count();
      if (!inlineCount) failures.push(language + " A2/S03 inline formulas should remain inside method lists");
      if (displayCount) failures.push(language + " A2/S03 inline formulas must not become display math");
      await tabs.nth(3).click();
      if (!(await page.locator("#reference-panel-3 .reference-block").count())) failures.push(language + " A2/S03 worked examples missing");
      await tabs.nth(4).click();
      if (!(await page.locator("#reference-panel-4 .reference-block").count())) failures.push(language + " A2/S03 solved exercises missing");
      await tabs.nth(5).click();
      if (!(await page.locator("#reference-panel-5 pre.reference-code code").count())) failures.push(language + " A2/S03 severity lab code missing");
      await tabs.nth(6).click();
      if (!(await page.locator("#reference-panel-6 .reference-table").count())) failures.push(language + " A2/S03 glossary missing");
      await page.setViewportSize({ width: 320, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(language + " A2/S03 reference sheet overflow at 320px");
    }

    // A2/S02 reference sheet: discrete distributions and claim frequency.
    for (const language of ["fr", "en"]) {
      const path = language === "en" ? "en/a2/s02/index.html" : "a2/s02/index.html";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(new URL(path, BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-mode").waitFor({ state: "visible" });
      await page.locator("#mode-reference").click();
      await page.waitForFunction(() => {
        const sheet = document.querySelector("#reference-sheet");
        const panel = document.querySelector("#reference-panel-0");
        return sheet && !sheet.hidden && panel && !panel.hidden;
      }, null, { timeout: 5000 }).catch(async () => {
        const state = await page.evaluate(() => ({
          sheetHidden: document.querySelector("#reference-sheet")?.hidden,
          panelHidden: document.querySelector("#reference-panel-0")?.hidden,
          tabs: document.querySelectorAll("#reference-tabs [role=tab]").length
        }));
        console.error("A2/S02 reference-mode diagnostic:", language, state, errors);
        failures.push(language + " A2/S02 reference mode failed to expose overview");
      });
      const tabs = page.locator("#reference-tabs [role=tab]");
      if (await tabs.count() !== 7) failures.push(language + " A2/S02 should have seven tabs");
      await tabs.nth(1).click();
      if (!(await page.locator("#reference-panel-1 .reference-formula .katex-display").count())) failures.push(language + " A2/S02 display formulas should render");
      await tabs.nth(2).click();
      if (!(await page.locator("#reference-panel-2 .katex").count())) failures.push(language + " A2/S02 inline method formulas should render");
      const inlineCount = await page.locator("#reference-panel-2 .reference-block li .katex").count();
      const displayCount = await page.locator("#reference-panel-2 .reference-block li .katex-display").count();
      if (!inlineCount) failures.push(language + " A2/S02 inline formulas should remain inside method lists");
      if (displayCount) failures.push(language + " A2/S02 inline formulas must not become display math");
      await tabs.nth(3).click();
      if (!(await page.locator("#reference-panel-3 .reference-block").count())) failures.push(language + " A2/S02 worked examples missing");
      await tabs.nth(4).click();
      if (!(await page.locator("#reference-panel-4 .reference-block").count())) failures.push(language + " A2/S02 solved exercises missing");
      await tabs.nth(5).click();
      if (!(await page.locator("#reference-panel-5 pre.reference-code code").count())) failures.push(language + " A2/S02 portfolio lab code missing");
      await tabs.nth(6).click();
      if (!(await page.locator("#reference-panel-6 .reference-table").count())) failures.push(language + " A2/S02 glossary missing");
      await page.setViewportSize({ width: 320, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(language + " A2/S02 reference sheet overflow at 320px");
    }

    // A2/S01 reference sheet: Bayes, conditional probabilities and portfolio interpretation.
    for (const language of ["fr", "en"]) {
      const path = language === "en" ? "en/a2/s01/index.html" : "a2/s01/index.html";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(new URL(path, BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-mode").waitFor({ state: "visible" });
      await page.locator("#mode-reference").click();
      await page.waitForFunction(() => {
        const sheet = document.querySelector("#reference-sheet");
        const panel = document.querySelector("#reference-panel-0");
        return sheet && !sheet.hidden && panel && !panel.hidden;
      }, null, { timeout: 5000 }).catch(async () => {
        const state = await page.evaluate(() => ({
          sheetHidden: document.querySelector("#reference-sheet")?.hidden,
          panelHidden: document.querySelector("#reference-panel-0")?.hidden,
          tabs: document.querySelectorAll("#reference-tabs [role=tab]").length
        }));
        console.error("A2/S01 reference-mode diagnostic:", language, state, errors);
        failures.push(language + " A2/S01 reference mode failed to expose overview");
      });
      const tabs = page.locator("#reference-tabs [role=tab]");
      if (await tabs.count() !== 7) failures.push(language + " A2/S01 should have seven tabs");
      await tabs.nth(1).click();
      if (!(await page.locator("#reference-panel-1 .reference-formula .katex-display").count())) failures.push(language + " A2/S01 display formulas should render");
      await tabs.nth(2).click();
      if (!(await page.locator("#reference-panel-2 .katex").count())) failures.push(language + " A2/S01 inline notation in methods should render");
      const inlineCount = await page.locator("#reference-panel-2 .reference-block li .katex").count();
      const displayCount = await page.locator("#reference-panel-2 .reference-block li .katex-display").count();
      if (!inlineCount) failures.push(language + " A2/S01 inline math should be inside method lists");
      if (displayCount) failures.push(language + " A2/S01 inline math should not become display math");
      await tabs.nth(3).click();
      if (!(await page.locator("#reference-panel-3 .reference-block").count())) failures.push(language + " A2/S01 worked examples missing");
      await tabs.nth(4).click();
      if (!(await page.locator("#reference-panel-4 .reference-block").count())) failures.push(language + " A2/S01 solved exercises missing");
      await tabs.nth(5).click();
      if (!(await page.locator("#reference-panel-5 pre.reference-code code").count())) failures.push(language + " A2/S01 Python lab missing");
      await tabs.nth(6).click();
      if (!(await page.locator("#reference-panel-6 .reference-table").count())) failures.push(language + " A2/S01 glossary missing");
      await page.setViewportSize({ width: 320, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(language + " A2/S01 reference sheet overflow at 320px");
    }

    // A1/S03 reference sheet is ready and must be rendered and usable in both languages.
    for (const language of ["fr", "en"]) {
      const path = language === "en" ? "en/a1/s03/index.html" : "a1/s03/index.html";
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(new URL(path, BASE).toString(), { waitUntil: "domcontentloaded" });
      await page.locator("#lesson-mode").waitFor({ state: "visible" });
      await page.locator("#mode-reference").click();
      await page.waitForFunction(() => {
        const sheet = document.querySelector("#reference-sheet");
        const panel = document.querySelector("#reference-panel-0");
        return sheet && !sheet.hidden && panel && !panel.hidden;
      }, null, { timeout: 5000 }).catch(async () => {
        const state = await page.evaluate(() => ({
          sheetHidden: document.querySelector("#reference-sheet")?.hidden,
          panelHidden: document.querySelector("#reference-panel-0")?.hidden,
          modePressed: document.querySelector("#mode-reference")?.getAttribute("aria-pressed"),
          tabs: document.querySelectorAll("#reference-tabs [role=tab]").length
        }));
        console.error("S03 reference-mode diagnostic:", language, state, errors);
        failures.push(language + " reference mode failed to expose the overview panel");
      });
      const tabs = page.locator("#reference-tabs [role=tab]");
      if (await tabs.count() !== 7) failures.push(language + " S03 should have seven reference tabs");
      await tabs.nth(1).click();
      if (!(await page.locator("#reference-panel-1 .reference-formula .katex-display").count())) failures.push(language + " S03 display equations should be typeset");
      await tabs.nth(2).click();
      if (!(await page.locator("#reference-panel-2 .katex").count())) failures.push(language + " S03 inline notation in methods should be typeset");
      const inlineMathCount = await page.locator("#reference-panel-2 .reference-block li .katex").count();
      const displayMathInParagraphs = await page.locator("#reference-panel-2 .reference-block li .katex-display").count();
      if (!inlineMathCount) failures.push(language + " S03 inline formulas should remain inside paragraphs");
      if (displayMathInParagraphs) failures.push(language + " S03 inline formulas must not become display equations");
      await tabs.nth(3).click();
      if (!(await page.locator("#reference-panel-3 .reference-block").count())) failures.push(language + " S03 worked examples missing");
      await tabs.nth(4).click();
      if (!(await page.locator("#reference-panel-4 .reference-block").count())) failures.push(language + " S03 corrected exercises missing");
      await tabs.nth(5).click();
      if (!(await page.locator("#reference-panel-5 pre.reference-code code").count())) failures.push(language + " S03 code lab missing");
      await tabs.nth(6).click();
      if (!(await page.locator("#reference-panel-6 .reference-table").count())) failures.push(language + " S03 bilingual glossary missing");
      await page.setViewportSize({ width: 320, height: 844 });
      if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)) failures.push(language + " S03 sheet overflow at 320px");
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(new URL("a1/s04/index.html", BASE).toString(), { waitUntil: "domcontentloaded" });
    if (await page.locator("#lesson-mode").isVisible()) failures.push("sessions without a ready reference sheet should not expose the sheet switch");

    if (errors.length) failures.push("page errors: " + errors.join("; "));
    if (failures.length) {
      console.error("FAILED:", failures.join("; "));
      process.exitCode = 1;
    } else {
      console.log("OK: responsive bilingual homepage");
    }
  } catch (error) {
    console.error("HOMEPAGE TEST ERROR:", error && error.stack || error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
