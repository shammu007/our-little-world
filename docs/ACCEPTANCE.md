# Manual acceptance checklist

Run on a laptop (Chrome or Safari) **and** a phone, against the deployed Vercel URL with Supabase configured.

**Entrance**
- [ ] Welcome screen asks "Who is entering our little world?" with **Me** and **Sweetheart**. No email, password or sign-up anywhere.
- [ ] A wrong answer shows a friendly hint; correct answers continue. Access code field appears only if you set one.
- [ ] The matching avatar (male for Me, female for Sweetheart) is previewed, then **Step inside** shows the loading screen and the garden entrance.

**World**
- [ ] Muted sage garden, natural trees, small white flowers, beige stone path, soft daylight.
- [ ] Cake in the centre has exactly 25 flickering candles; the sign reads "happy 25! sweetheart" and is easy to read.
- [ ] Near the cake, E (or the round button) blows the candles out one by one with smoke, a little confetti and a music-box tune. Pressing again relights.
- [ ] The house door opens as you approach. Walls cannot be walked through; the camera never pokes through walls or the ceiling.
- [ ] The hall has matte white walls, light oak floor, minimal furniture, 12 to 20 frames at the same eye level on the left, main and right walls, and photos keep their proportions.
- [ ] The electric-blue circular portal sits in a clear section in the middle of the main wall.

**Gallery**
- [ ] Walking up to a frame shows "Look closer"; E or a tap opens a large photo with its caption; arrows browse; Esc / ✕ closes.
- [ ] As owner: pencil → owner code → upload photos, edit captions, reorder, move between walls, save. Changes appear in the hall and on the other device after it re-enters.

**Portal and letter**
- [ ] Approaching the portal makes it brighter and shows the clue.
- [ ] A wrong answer gets a kind retry message, and the hint after a few tries.
- [ ] The right answer triggers the portal flash and opens the letter, which fades in line by line.
- [ ] In browser dev tools (Network tab) the letter text is not present before the correct answer.

**Together**
- [ ] Two devices (one as Me, one as Sweetheart) see each other walking smoothly with name tags; the top-left status shows the other is here.
- [ ] Blowing out the candles on one device happens on the other.
- [ ] Switching off Wi-Fi briefly shows "Reconnecting…" and recovers.
- [ ] Opening the same role in another tab moves the session there; the old tab offers **Continue here**.
- [ ] A third browser cannot take a slot while both people are active.

**Comfort**
- [ ] Mute button works; Settings → Reduced motion calms camera intro, confetti and portal swirl; Light graphics runs smoothly on the phone.
- [ ] Phone: joystick walks, right-side drag looks, the round button interacts; dialogs fit the screen in portrait and landscape.
