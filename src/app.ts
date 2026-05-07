import "dotenv/config";
import axios from "axios";
import fs from "fs";
import { decode } from "html-entities";

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
        const file = fs.readFileSync(filePath);

        // Send file to Tika server 
        const res = await axios.put(TIKA_URL, file, { 
            headers: { 
                "Content-Type": "application/pdf", // Adjust content type as needed "octet-stream for "
                "Accept": "application/json"
            }
        }); 

        // Extract text
        const data = res.data; 

        // console.log("Full response:"); 
        console.log(JSON.stringify(data, null, 2));
        const contentObject = data.find((item: any) => item["X-TIKA:content"] !== undefined);
        
        let raw = contentObject ? contentObject["X-TIKA:content"] : "";

        raw = decode(raw);

        let text = raw
        .replace(/<head>[\s\S]*?<\/head>/gi, "") // Remove head section
        .replace(/<\/p>/gi, "\n\n") // Create paragraphs
        .replace(/<br ?\/?>/gi, "\n") // Create line breaks
        .replace(/<[^>]+>/g, "")    // Remove all other HTML tags
        .replace(/\n{3,}/g, "\n\n") // Replace multiple newlines with a maximum of two
        .trim();
        
console.log("TEXT LENGTH:", text.length);
console.log("TEXT START:", text.substring(0, 200));


        
const pages = text.includes("\f")
  ? text.split("\f")
  : [text];

  pages.forEach((page: string, pageIndex: number) => {
    console.log(`\n==== Sida ${pageIndex + 1}====\n`);

const paragraphs = page.split("\n\n"); 
paragraphs.forEach((p: string) => { 
    console.log(p.trim());
    console.log("");
}); 

    });

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}


run();