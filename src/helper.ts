import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import * as cheerio from "cheerio"

export async function contentToPdf(content: string, path: string) {
  const doc = new PDFDocument();
  const stream = createWriteStream(path);
  doc.pipe(stream);
  doc.text(content!, 50, 50);
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return path;
}

export async function scrapeBody(url: string) {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);
    const bodyContent = $("body").text().replaceAll("\n", " ").replaceAll("    ", "");
    return bodyContent;
  } catch (error) {
    console.error("Error fetching the website:", error);
  }
}