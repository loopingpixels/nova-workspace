
import os
import requests
import json
import re

# --- Configuration ---
# Read credentials from files
try:
    with open(".openclaw/private/wordpress_api_key.txt", "r") as f:
        config_lines = f.readlines()
        CLIENT_ID = next(line.split('=')[1].strip() for line in config_lines if "CLIENT_ID" in line)
        CLIENT_SECRET = next(line.split('=')[1].strip() for line in config_lines if "CLIENT_SECRET" in line)
    with open(".openclaw/private/wordpress_access_token.txt", "r") as f:
        ACCESS_TOKEN = f.read().strip()
except FileNotFoundError:
    print("Error: WordPress API credentials files not found.")
    exit(1)
except Exception as e:
    print(f"Error reading credentials: {e}")
    exit(1)

BLOG_ID = "237125894" # Retrieved from previous token exchange
SITE_URL = "https://public-api.wordpress.com/rest/v1.1/sites/" + BLOG_ID

# --- Post Content ---
TITLE = "Sticker Boy and Sticker Girl"
RAW_STORY_CONTENT = (
    "One day, our little Leon discovered a treasure trove of stickers! He enthusiastically decorated himself from head to toe, especially his face and hands. "
    "\"I'm Sticker Boy!\" he declared, doing a happy little dance.\n\n"
    "Later, when it was bedtime stories, he insisted on being called Sticker Boy. And if Thaththi forgot and asked a story question without using his new title, he wouldn't answer!\n\n"
    "Not to be left out, Maylee, without any stickers of her own, brilliantly pretended! She adorned herself with imaginary stickers and proudly announced herself as Sticker Girl. "
    "It was a day filled with giggles, imagination, and a whole lot of stickering fun!"
)

IMAGE_PATHS = [
    "/home/roshan/.openclaw/media/inbound/158cd21c-b20d-4b1e-8dbb-295cdaee7907.jpg",
    "/home/roshan/.openclaw/media/inbound/1dc0169a-e8be-45e9-9b84-81d610ca2a2c.jpg",
    "/home/roshan/.openclaw/media/inbound/de2feeb9-9e98-4d33-b94a-aabddf913e41.jpg",
    "/home/roshan/.openclaw/media/inbound/f1189e4b-e41f-4f6c-9607-1ac6db4db225.jpg",
]

# Updated Categories
CATEGORIES = ["Leon", "Maylee", "Leon and Maylee", "Family Life"]
TAGS = ["Funny", "Sibling Moments", "Sweet Moments", "Kids"]

# --- Helper Functions ---
def clean_content(content):
    # Remove specific phrases like "(that's you, boss!)"
    content = re.sub(r'\(that\'s you, boss!\)', '', content).strip()
    # Replace \n with actual newlines, then remove all multiple newlines
    content = content.replace("\\n", "\n")
    content = re.sub(r'\n\s*\n+', '\n\n', content) # Reduce multiple newlines to single paragraph break
    return content.strip()

def upload_image(image_path, access_token):
    headers = {
        "Authorization": f"Bearer {access_token}"
    }
    
    try:
        import mimetypes
        mime_type = mimetypes.guess_type(image_path)[0] or 'application/octet-stream'
    except ImportError:
        mime_type = 'image/jpeg' if image_path.lower().endswith(('.jpg', '.jpeg')) else \
                    'image/png' if image_path.lower().endswith('.png') else \
                    'application/octet-stream'

    files = {
        'media[]': (os.path.basename(image_path), open(image_path, 'rb'), mime_type)
    }
    data = {
        'alt_text': os.path.basename(image_path).split('.')[0]
    }

    print(f"Attempting to upload image: {image_path} with MIME type {mime_type}")
    try:
        response = requests.post(f"{SITE_URL}/media/new", headers=headers, files=files, data=data)
        response.raise_for_status() # Raise an exception for HTTP errors
        media_data = response.json()
        print(f"Upload response: {json.dumps(media_data, indent=2)}")
        if media_data and 'media' in media_data and len(media_data['media']) > 0:
            # Return the full media object, not just the URL, for gallery use
            return media_data['media'][0]
        else:
            print(f"Error: Unexpected media upload response structure for {image_path}: {media_data}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error uploading image {image_path}: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response content: {e.response.text}")
        return None

def create_and_publish_post(title, content, categories, tags, access_token):
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    post_data = {
        "title": title,
        "content": content,
        "categories": categories,
        "tags": tags,
        "status": "publish" # Force publish
    }

    print(f"Attempting to create and publish post with title: {title}")
    try:
        response = requests.post(f"{SITE_URL}/posts/new", headers=headers, data=json.dumps(post_data))
        response.raise_for_status() # Raise an exception for HTTP errors
        post_info = response.json()
        print(f"Post response: {json.dumps(post_info, indent=2)}")
        if post_info and 'URL' in post_info:
            return post_info['URL']
        else:
            print(f"Error: Unexpected post creation response structure: {post_info}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error creating and publishing post: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response content: {e.response.text}")
        return None

# --- Main Logic ---
if __name__ == "__main__":
    # 1. Clean the story content
    cleaned_story_content = clean_content(RAW_STORY_CONTENT)

    # 2. Upload images and collect media IDs for gallery
    uploaded_media_items = []
    for image_path in IMAGE_PATHS:
        media_item = upload_image(image_path, ACCESS_TOKEN)
        if media_item:
            uploaded_media_items.append(media_item)
        else:
            print(f"Failed to upload {image_path}. Aborting post creation.")
            exit(1)

    # 3. Create gallery block for Gutenberg
    gallery_block = ""
    if uploaded_media_items:
        media_ids = [str(item['ID']) for item in uploaded_media_items if 'ID' in item]
        if media_ids:
            gallery_ids_str = ",".join(media_ids)
            
            # Construct the inner images for the gallery block
            inner_images_html_parts = []
            for item in uploaded_media_items:
                if 'URL' in item and 'ID' in item:
                    # Using raw string literals for f-strings containing backslashes
                    inner_images_html_parts.append(rf'  <figure class="wp-block-image size-large"><img src="{item['URL']}" alt="" data-id="{item['ID']}"/></figure>')
            inner_images_html = "\n".join(inner_images_html_parts)

            gallery_block = (
                f'<!-- wp:gallery {{"ids":[{gallery_ids_str}],"columns":{len(media_ids)}}} -->\n'
                f'<figure class="wp-block-gallery has-nested-images columns-{len(media_ids)} is-cropped">\n'
                f'{inner_images_html}\n'
                f'</figure><!-- /wp:gallery -->\n'
            )
        else:
            print("Warning: No valid media IDs found for gallery.")

    # Combine cleaned content and gallery
    full_post_content = cleaned_story_content
    if gallery_block:
        full_post_content += f"\n\n{gallery_block}"

    # 4. Create and publish the post
    post_url = create_and_publish_post(TITLE, full_post_content, CATEGORIES, TAGS, ACCESS_TOKEN)

    if post_url:
        print(f"POST_SUCCESS: {post_url}")
    else:
        print("POST_FAILURE: Failed to publish the post.")
        exit(1)
