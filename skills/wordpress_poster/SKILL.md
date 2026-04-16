# WordPress Poster Skill

This skill allows me to publish posts to the Mayleo Tales WordPress blog (`https://mayleotales.wordpress.com`).

## Usage

To use this skill, I will perform the following steps:

1.  **Retrieve API Key:** Read the WordPress API key from `.openclaw/private/wordpress_api_key.txt`.
2.  **Construct Post Data:** Prepare the post title, content, categories, and tags based on the provided story and images.
3.  **Publish Post:** Use the WordPress.com API to publish the post.
4.  **Return Public Link:** Provide the public URL of the newly published post.

## Mayleo Tales Label Standard

### Kid tags
- `Leon`
- `Maylee`
- `Leon and Maylee`

### Story tags
- `Funny`
- `Kindy`
- `Family Life`
- `Sibling Moments`
- `Quotes`
- `Milestones`
- `Mischief`
- `Learning`
- `Outings`
- `Bedtime`
- `Food`
- `Tantrums`
- `Sweet Moments`

## Example (Internal)

```tool_code
print(default_api.exec(command='''
# This is a placeholder for the actual WordPress API call.
# In a real scenario, this would involve a cURL request or a Python script
# interacting with the WordPress.com REST API.

# Example API call (conceptual, not runnable as-is):
# curl -X POST "https://public-api.wordpress.com/rest/v1.1/sites/mayleotales.wordpress.com/posts/new" \
#      -H "Authorization: Bearer $(cat .openclaw/private/wordpress_api_key.txt)" \
#      -H "Content-Type: application/json" \
#      -d '{
#            "title": "My Awesome Post",
#            "content": "This is the content of my awesome post.",
#            "categories": ["Family Life"],
#            "tags": ["Leon", "Funny"]
#          }'
'''))
```
