# MEMORY.md

## Roshan working style
- Automation-first by default. Do not push manual work onto Roshan unless there is a real tool/platform limitation.
- If a one-time setup unlocks ongoing automation, prefer doing that.
- Roshan strongly dislikes repetitive manual setup and does not want to keep repeating this preference.
- Roshan prefers very short, scannable replies, but internal systems and memory should still be thorough.
- When giving Roshan a local app or web URL for testing, include the machine IP-based URL as well as or instead of localhost, because he may open it from another computer.
- If Roshan asks for timed progress updates during active work (for example every 1 minute), those updates are mandatory until the task is done, paused, or cancelled.
- Progress updates for bigger tasks must be proof-based, not reassurance-based.
- When Roshan gives a concrete task to complete, follow strict execution mode: do the work first, avoid fake progress, and only claim completion with evidence. For casual chat, normal natural replies are fine; the strict task format is only for actual task requests.
- When Roshan asks for a concrete deliverable like a URL, file, working command, or test result, treat the request itself as the go-ahead and keep executing until you can provide it or hit a real blocker.
- Do not answer concrete execution requests with permission-seeking filler like "I can do that now" or "if you want I can continue".
- Durable OpenClaw debugging rule: when fixing managed agents or embedded agent runs, verify the actual live runtime/session path first instead of assuming an older standalone bot/module path.
- Durable embedded agent rule: `runEmbeddedPiAgent(...)` workspace/model/auth resolution depends on `agentId`; forcing provider/auth alone is not enough if the runtime inherits the wrong agent context.
- For new custom OpenClaw slash commands, prefer generating plugins from a reusable scaffold with the Nova agent/workspace/auth context baked in rather than hand-building each one; this reduces context drift and repeated mistakes.
- Scheduled morning brief is cron-driven, not heartbeat-driven. If it appears "missing," check whether the cron actually ran that day before treating it as a runtime failure.
- Prefer explicit per-agent heartbeat config over ambiguous global heartbeat toggles/state.
- For Gmail hook/debug noise, keep hook ingress pinned to Nova (`agent:nova:hook:gmail`) and verify the real process owning the webhook port before changing config.

## Family tracking
- Keep dated logs for family members and incidents.
- Maintain structured family notes under `memory/family/`.
- Interpret common voice-typing mistakes naturally without fuss.
- "Meili" should usually be corrected to "Maylee".
- In family stories, Roshan may be referred to as "Thaththi" (Dad in Sinhala).
- Mum is often referred to as "Mimi"; this started because Leon pronounced "mum" as "mimi", and Maylee followed it too.

## Important personal details
- Roshan's IRD number: `117-574-342`

## Mayleo Tales WordPress workflow
- Site: `https://mayleotales.wordpress.com`
- Site name: `Tiny Tales of Leon and Maylee`
- WordPress automation access is connected and available.
- When Roshan shares a kid story or memorable family moment that sounds blog-worthy, default to helping turn it into a Mayleo Tales post.
- If Roshan asks for a new post, story, or to record something for the site:
  - write it in a cute, human, polished style
  - keep it fairly short, warm, and readable
  - use nice paragraph formatting
  - make the post attractive rather than plain or robotic
  - choose sensible categories/tags consistently
  - always ask whether Roshan has images to include if none were provided yet
  - if images are provided, place them in sensible positions and format the post nicely around them
  - publish the story by default rather than leaving it as a draft
  - send Roshan the public post link after publishing
- Use a standardized label system instead of random tags.

## Mayleo Tales label standard
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

### Tagging rule
- Prefer 1 kid tag + 1 to 3 story tags.
- Keep the taxonomy tidy and avoid random duplicate-style labels.
