import "dotenv/config";
import axios from "axios";
import fs from "fs";
import { decode } from "html-entities";
import * as cheerio from "cheerio";

const TIKA_URL = process.env.TIKA_URL!; 

if (!TIKA_URL) {
    console.error("Error: TIKA_URL is missing in .env"); 
    process.exit(1);
}       

async function run () { 
    const filePath = process.argv[2];

    if (!filePath) {
        console.log("Usage: npx ts-node src/app.ts "+ "<path_to_file>");
        process.exit(1);
    }

    try { 
        // Read file 
        const file = fs.readFileSync(filePath); // Change to readFile if performance is an issue. 

        // Send file to Tika server 
        const res = await axios.put(TIKA_URL, file, { 
            headers: { 
                "Content-Type": "application/octet-stream", 
                "Accept": "application/json"
            }
        }); 

        // Extract text
        const data = res.data; 

        const contentObject = data.find((item: any) => item["X-TIKA:content"]);
        
        let raw = contentObject ?.["X-TIKA:content"] || "";

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

            if (text.length < 80 && !text.includes(".")) {
                type = "heading";
            }

            if (/^\d+\./.test(text)) {
                type = "list-item";
            }

            paragraphs.push({
                id: index + 1,
                text,
                type
            });
        });

        const sections: { 
            heading: string; 
            content: string[];
            }[] = [];

            let currentSection: { heading: string; content: string[] } | null = null;

            paragraphs.forEach(p => {
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
        

        const plainText = paragraphs.map(p => p.text).join("\n\n");
       

        const result = { 
            text: plainText,
            paragraphs, 
            sections
         };

         console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}


run();