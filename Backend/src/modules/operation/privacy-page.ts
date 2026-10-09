import { sanitizeDocumentContent } from "./rich-text.js";

export type PublicPrivacyDocument = {
  title: string;
  version: string;
  content: string;
  publishedAt: Date | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderContent(value: string) {
  const html = /<[a-z][\s\S]*>/i.test(value)
    ? value
    : `<p>${escapeHtml(value).replaceAll("\n", "<br>")}</p>`;
  return sanitizeDocumentContent(html);
}

/** 与 App 使用同一份后台已发布文档，供浏览器和应用商店直接访问。 */
export function renderPrivacyPage(brandName: string, document: PublicPrivacyDocument) {
  const brand = escapeHtml(brandName);
  const title = escapeHtml(document.title);
  const version = escapeHtml(document.version);
  const publishedDate = document.publishedAt
    ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric" }).format(document.publishedAt)
    : "";

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="description" content="${brand}隐私政策">
  <meta name="theme-color" content="#f6f8fc">
  <title>${title}｜${brand}</title>
  <style>
    :root { color-scheme: light; font-family: "PingFang SC","Microsoft YaHei",system-ui,sans-serif; color: #18243a; background: #f6f8fc; }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; }
    a { color: #255ac0; overflow-wrap: anywhere; }
    a:focus-visible { outline: 3px solid #255ac0; outline-offset: 3px; border-radius: 2px; }
    .masthead { border-bottom: 1px solid #dce4f0; background: #fff; }
    .masthead-inner { max-width: 820px; margin: auto; padding: 16px 24px; display: flex; align-items: center; gap: 10px; color: #18243a; font-weight: 700; text-decoration: none; }
    .mark { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; color: #fff; background: #255ac0; font-size: 17px; line-height: 1; }
    main { max-width: 820px; margin: 0 auto; padding: 48px 24px 80px; }
    .heading { padding-bottom: 28px; border-bottom: 2px solid #255ac0; }
    h1 { margin: 0 0 16px; font-size: clamp(28px,5vw,38px); line-height: 1.3; letter-spacing: -.025em; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px 22px; margin: 0; color: #526078; font-size: 14px; }
    article { padding-top: 28px; color: #26344b; font-size: 16px; line-height: 1.9; overflow-wrap: anywhere; }
    article :first-child { margin-top: 0; }
    article h1, article h2, article h3, article h4 { color: #18243a; line-height: 1.4; margin: 2em 0 .7em; }
    article h1 { font-size: 24px; } article h2 { font-size: 21px; } article h3 { font-size: 18px; } article h4 { font-size: 16px; }
    article p { margin: 0 0 1.15em; }
    article ul, article ol { padding-left: 1.5em; margin: 0 0 1.15em; }
    article li { padding-left: .2em; margin-bottom: .45em; }
    article blockquote { margin: 1.5em 0; padding: 12px 18px; border-left: 3px solid #255ac0; background: #eaf0fa; }
    article img { max-width: 100%; height: auto; }
    article pre { overflow-x: auto; padding: 14px; background: #eaf0fa; border-radius: 8px; }
    article hr { border: 0; border-top: 1px solid #dce4f0; margin: 28px 0; }
    footer { max-width: 820px; margin: 0 auto; padding: 22px 24px 36px; border-top: 1px solid #dce4f0; color: #66748a; font-size: 13px; }
    @media (max-width: 600px) { main { padding-top: 34px; padding-bottom: 56px; } article { font-size: 15px; } }
  </style>
</head>
<body>
  <header class="masthead"><a class="masthead-inner" href="/download"><span class="mark" aria-hidden="true">书</span><span>${brand}</span></a></header>
  <main>
    <div class="heading"><h1>${title}</h1><p class="meta"><span>版本 ${version}</span>${publishedDate ? `<span>发布日期 ${publishedDate}</span>` : ""}</p></div>
    <article>${renderContent(document.content)}</article>
  </main>
  <footer>© ${new Date().getFullYear()} ${brand}</footer>
</body>
</html>`;
}
