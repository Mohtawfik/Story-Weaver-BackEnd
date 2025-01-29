import sys
import json
from transformers import pipeline

# Load GPT-Neo model
generator = pipeline("text-generation", model="EleutherAI/gpt-neo-1.3B")

def generate_story(keywords, length):
    prompt = f"Write a {length.lower()} story including the keywords: {', '.join(keywords)}."
    max_length = 50 if length == "Short" else 150 if length == "Medium" else 300

    result = generator(prompt, max_length=max_length, num_return_sequences=1)
    return result[0]["generated_text"]

if __name__ == "__main__":
    # Read arguments from Node.js
    keywords = json.loads(sys.argv[1])
    length = sys.argv[2]
    story = generate_story(keywords, length)
    print(story)
