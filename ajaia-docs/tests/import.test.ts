import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  convertUploadToHtml,
  getExtension,
  ImportError,
  MAX_UPLOAD_BYTES,
  textToHtml,
  titleFromFilename,
} from "@/lib/import";
import { sanitizeHtml } from "@/lib/sanitize";

async function buildDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const body = paragraphs.map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("file name helpers", () => {
  it("reads extensions case-insensitively", () => {
    expect(getExtension("Notes.MD")).toBe(".md");
    expect(getExtension("archive.tar.gz")).toBe(".gz");
    expect(getExtension("README")).toBe("");
  });

  it("builds a readable title from the file name", () => {
    expect(titleFromFilename("meeting_notes-q3.txt")).toBe("meeting notes q3");
    expect(titleFromFilename(".txt")).toBe(".txt");
  });
});

describe("textToHtml", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(textToHtml("one\ntwo\n\nthree")).toBe("<p>one<br>two</p><p>three</p>");
  });

  it("escapes HTML so pasted markup stays plain text", () => {
    expect(textToHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });
});

describe("convertUploadToHtml", () => {
  it("imports .txt files", async () => {
    const result = await convertUploadToHtml("plan.txt", Buffer.from("Hello\n\nWorld"));
    expect(result.title).toBe("plan");
    expect(result.html).toBe("<p>Hello</p><p>World</p>");
  });

  it("imports .md files with headings and lists", async () => {
    const markdown = "# Title\n\n- a\n- b\n\n**bold**";
    const result = await convertUploadToHtml("doc.md", Buffer.from(markdown));
    expect(result.html).toContain("<h1>Title</h1>");
    expect(result.html).toContain("<li>a</li>");
    expect(result.html).toContain("<strong>bold</strong>");
  });

  it("removes scripts from markdown", async () => {
    const result = await convertUploadToHtml(
      "evil.md",
      Buffer.from('hello <script>alert(1)</script> <img src=x onerror="alert(2)">'),
    );
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("onerror");
  });

  it("imports .docx files", async () => {
    const docx = await buildDocx(["First paragraph", "Second paragraph"]);
    const result = await convertUploadToHtml("report.docx", docx);
    expect(result.title).toBe("report");
    expect(result.html).toContain("<p>First paragraph</p>");
    expect(result.html).toContain("<p>Second paragraph</p>");
  });

  it("rejects a corrupted .docx", async () => {
    await expect(convertUploadToHtml("bad.docx", Buffer.from("not a zip"))).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it("rejects unsupported types, empty files, and oversized files", async () => {
    await expect(convertUploadToHtml("photo.png", Buffer.from("x"))).rejects.toThrow(
      /Unsupported file type/,
    );
    await expect(convertUploadToHtml("empty.txt", Buffer.alloc(0))).rejects.toThrow(/empty/);
    await expect(
      convertUploadToHtml("big.txt", Buffer.alloc(MAX_UPLOAD_BYTES + 1, "a")),
    ).rejects.toThrow(/too large/);
  });
});

describe("sanitizeHtml", () => {
  it("strips dangerous tags, handlers, and script URLs", () => {
    const dirty =
      '<p onclick="x()">ok</p><iframe src="//evil"></iframe><a href="javascript:alert(1)">link</a><style>p{}</style>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain("<p>ok</p>");
    expect(clean).not.toContain("iframe");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<style");
  });

  it("leaves normal formatting alone", () => {
    const html = "<h2>Hi</h2><ul><li><em>one</em></li></ul>";
    expect(sanitizeHtml(html)).toBe(html);
  });
});
