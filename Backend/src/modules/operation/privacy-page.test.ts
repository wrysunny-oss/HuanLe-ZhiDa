import assert from "node:assert/strict";
import test from "node:test";
import { renderPrivacyPage } from "./privacy-page.js";

test("privacy page renders published content as a readable public document", () => {
  const html = renderPrivacyPage("幻乐灵玑笔记", {
    title: "隐私政策",
    version: "1.0",
    content: "<h2>信息收集</h2><p>我们仅按政策说明处理信息。</p>",
    publishedAt: new Date("2026-10-08T16:00:00Z"),
  });
  assert.match(html, /<title>隐私政策｜幻乐灵玑笔记<\/title>/);
  assert.match(html, /2026年10月9日/);
  assert.match(html, /<h2>信息收集<\/h2>/);
  assert.match(html, /<meta name="viewport"/);
});

test("privacy page escapes metadata and sanitizes published rich text", () => {
  const html = renderPrivacyPage("<script>brand</script>", {
    title: '<img src=x onerror="alert(1)">',
    version: "1.0",
    content: '<p>正文</p><script>alert(1)</script><a href="javascript:alert(1)">危险链接</a>',
    publishedAt: null,
  });
  assert.doesNotMatch(html, /<script>|<[^>]*\bonerror=|href="javascript:/);
  assert.match(html, /&lt;script&gt;brand&lt;\/script&gt;/);
  assert.match(html, /<p>正文<\/p>/);
});
