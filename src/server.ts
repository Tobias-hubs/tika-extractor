import "dotenv/config";
import express from "express";
import multer from "multer";
import axios from "axios";
import { decode } from "html-entities";
import * as cheerio from "cheerio";

const app = express();
const upload = multer();

const TIKA_URL = process.env.TIKA_URL!;

if (!TIKA_URL) {
    throw new Error("TIKA_URL is missing in .env");
}

function parseDocument(raw: string) {
    raw = decode(raw);

    const cheerioParse = cheerio.load(raw);

    const paragraphs: { 
        id: number; 
        text: string; 
        type: string; 
    }[] = [];

    cheerioParse("p").each((index, element) => {
        let text = cheerioParse(element).text().trim();

        if (!text) return;
        text = text.replace(/\n/g, " ");
        
        let type = "paragraph";

        const words = text.split(" ").length; 
        if (words < 10 && text.length < 100 && !text.endsWith(".")) { 
            type = "heading"; 
        }

        if (/^(\d+\.|-|\*)/.test(text)) {
            type = "list-item";
        }

        paragraphs.push({ 
            id: index + 1,
            text,
            type
        }); 
    });

    // Remove duplicates
    const seen = new Set(); 
    const uniqueParagraphs = paragraphs.filter(p => { 
        if (seen.has(p.text)) return false; 
        seen.add(p.text);
        return true;
    }); 

    // Build sections 
    const sections: {
        heading: string; 
        content: string[];  
    }[] = [];

    let currentSection: { heading: string; content: string[] } | null = null;

    uniqueParagraphs.forEach(p => {
        if (p.type === "heading") {
            currentSection = {
                heading: p.text,
                content: []
            };
            sections.push(currentSection);
        } else if (currentSection) {
            currentSection.content.push(p.text);
        }
    });

    const text = uniqueParagraphs.map(p => p.text).join("\n\n");

    return {
        text,
        paragraphs: uniqueParagraphs,
        sections
    };
}

// API endpint 
app.post("/extract", upload.single("file"), async (req: any, res: any) => {
    try { 
        const file = req.file?.buffer; 

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const tikaResponse = await axios.put(TIKA_URL, file, { 
            headers: { 
                "Content-Type": "application/octet-stream", 
                "Accept": "application/json"
            }
        });

        const data = tikaResponse.data;

        const contentObject = data.find((item: any) => item["X-TIKA:content"]);

        const raw = contentObject?.["X-TIKA:content"] || "";

        const result = parseDocument(raw);

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    } 
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});




