# Vessels: a specific glass or mug for every drink

Every drink in the catalogue, and every drink the generator makes, is served in one specific vessel from a closed list of 34 (`data/vessels.json`). The Shrine draws each one to a common scale, about 38 units to the inch, so a coupe sits small beside a hurricane glass and a Scorpion bowl dwarfs both. This page records where the vessels come from, which drinks belong in which, and how a new drink gets its vessel.

## How a drink gets its vessel

1. **Catalogued drinks.** `web/lib/vessels.js` reads each record's free-text `glass` ("tall glass or tiki mug", "double old-fashioned, around a shaved-ice cone") and picks the most specific vessel it names: novelties and ceramics first, then named glasses, then generic glassware. So "tall glass or tiki mug" becomes the tiki mug. "Old fashioned" means two different glasses in tiki books. It becomes the double old fashioned for anything poured over crushed ice or longer than about 3¼ oz, and the single rocks glass otherwise. `scripts/merge.mjs` writes the result into each record as `vessel`.
2. **Identity-defining classics.** Some drinks own their vessel: the glass is named for them, or they were made for it. These are fixed by name for every spec of the drink:
   - the Zombie and Tortuga in the chimney glass;
   - the Mai Tai and Navy Grog in the double old fashioned;
   - the Fog Cutter in its mug;
   - the Singapore Sling in the sling glass;
   - Three Dots and a Dash in the footed pilsner;
   - the Pearl Diver in the Pearl Diver glass;
   - the Painkiller in the Pusser's tin;
   - the Shrunken Skull and Rum Barrel in their mugs;
   - the Pi Yi in a pineapple and the Coconaut in a coconut;
   - the Scorpion, Tiki, Kava and Volcano bowls.
3. **Generated drinks.** `engine.js` asks, in order:
   - Did the prompt name a vessel ("in a coconut", "skull mug", "zombie glass")? If so, the drink is served the way that vessel holds one: a coconut gets crushed ice, a coupe gets strained.
   - Is it a riff? Then it takes the source drink's vessel, or the vessel of another spec of the same drink if the source's doesn't fit. A single Scorpion does not come in the bowl.
   - Otherwise it scores every vessel that takes the drink's service (up, rocks, crushed, frozen, hot, or a bowl for three or more) and holds its volume. The score is the family's own vessel habits from the catalogue, a small researched affinity for the iconic ceramics, and a size fit. Crushed ice adds about half again to the volume. *Shake again* samples among the top few.
4. **Explanation.** The recipe says which vessel it chose and why: "Served in a chimney (Zombie) glass, the way the Zombie is served", or "the Grog family's usual vessel (73% of the catalogued family)". The vessel's story comes with it.

## A note on sources

Almost every cocktail history site blocks direct fetching from this research environment. The histories below are therefore built from search-result summaries of the cited pages, cross-checked against each other and against the catalogue's own glass fields. They were not read from Berry's or Trader Vic's books directly. Where accounts disagree or a claim couldn't be confirmed, the text says "reportedly", "said to" or "disputed". Capacities are typical figures (Libbey catalogue sizes where known), not measurements of the originals.

## Canonical vessels for the classics

The original serve where it is documented, and the common modern serve where it differs.

| Drink | Vessel | Notes |
|---|---|---|
| Mai Tai | double old fashioned | Trader Vic's guide: "mai tai (double old-fashioned) glass", over shaved ice with a spent lime shell and mint |
| Zombie | chimney (Zombie) glass | Don the Beachcomber, 1934: a tall glass, two per customer. Many modern bars use a collins |
| Navy Grog | double old fashioned | Don's version around a shaved-ice cone packed in a pilsner, with the straw through it; Vic's uses a rock-candy stick |
| Painkiller | Pusser's enamel tin | plastic cups at the Soggy Dollar Bar; the tin is Pusser's brand serve |
| Piña Colada | hurricane or poco grande | 1954 vessel undocumented; the Caribe Hilton uses a hurricane glass today |
| Hurricane | hurricane glass | Pat O'Brien's 1940s 26 oz lamp-shaped glass |
| Singapore Sling | sling (tulip) glass | Raffles' own glass; collins elsewhere |
| Scorpion | Scorpion bowl / double old fashioned | the bowl for four on kneeling hula girls; single serves in a DOF or goblet |
| Fog Cutter, Samoan Fog Cutter | Fog Cutter mug | on Trader Vic's menus since the early 1940s |
| Suffering Bastard | collins | Joe Scialom, Cairo, 1942. Trader Vic's rum version has its own "Mai Tai Joe" mug |
| Jungle Bird | bird-shaped ceramic (1973) | rocks or DOF at craft bars |
| Three Dots and a Dash, Nui Nui (Pupule), Port au Prince | footed pilsner | Don the Beachcomber's tall-glass drinks |
| Test Pilot, Jet Pilot, Ancient Mariner | double old fashioned | flash-blended, crushed ice |
| Pearl Diver | Pearl Diver glass | the glass is named for the drink |
| Missionary's Downfall, Daiquiri, Hemingway Daiquiri, Nuclear Daiquiri, Trinidad Sour | coupe | the Floridita's frozen daiquiri came in an 8.5 oz coupe |
| Beachcomber's Gold | coupe lined with an ice shell | Don the Beachcomber, 1937 |
| Saturn | coupe (competition, Smuggler's Cove) or sling / pilsner | accounts split |
| Blue Hawaii, Bahama Mama, Tropical Itch, Rum Runner, Chi Chi | hurricane glass | original vessels mostly undocumented; the Tropical Itch comes with a back-scratcher |
| Pi Yi, Lapu Lapu | hollowed pineapple | the Pi Yi in a baby pineapple on Donn's 1930s menu |
| Shrunken Skull | skull mug | the Mai-Kai's is really a shrunken head, by Al Kocab |
| Rum Barrel, Barrel O' Rum | barrel mug | Don the Beachcomber, Steve Crane's Luau, the Mai-Kai |
| Tiki Bowl, Kava Bowl, Mystery Drink | Tiki Bowl | earthen bowls on or of tikis, for two to four |
| Volcano Bowl | volcano bowl | rum burning in the central crater |
| Sidewinder's Fang | large snifter | orange-peel snake coiled inside |
| Coconaut | coconut | Jeff Berry, 1998 |
| Planter's Punch, Queen's Park Swizzle, Chartreuse Swizzle, Lost Lake | collins | |
| Mojito, Dark 'n Stormy | highball | |
| Caipirinha, Ti' Punch | rocks glass | the Ti' Punch small and often without ice |
| Hot Buttered Rum | Irish coffee glass or toddy mug | Trader Vic's 1947 guide: the ceramic skull mug |
| Rum Julep | julep cup | |

**Still open:**
- the shape of the Cobra's Fang's "tall curved glass" on Don's 1941 menu;
- whether the first Zombie glass was the straight Libbey-style chimney;
- the profile of the Raffles sling glass;
- the original vessels of the Piña Colada, Blue Hawaii, Rum Runner and Bahama Mama.

## The vessels

Generated from `data/vessels.json` and the catalogue by `scripts/vessels-doc.mjs`.

<!--VESSELS-->

### Glassware

**Coupe** · about 7 oz · takes up

The shallow champagne saucer of the 1660s (not, whatever the legend says, modelled on Marie Antoinette). It was the cocktail glass before and just after Prohibition, and the craft revival brought it back as the default glass for drinks served up. Don the Beachcomber lined one with a moulded shell of ice for the Beachcomber's Gold.

- Classics: Daiquiri, Hemingway Daiquiri, Beachcomber's Gold, Missionary's Downfall, Nuclear Daiquiri, Trinidad Sour
- In the catalogue: 302 drinks (e.g. Daiquiri, Missionary's Downfall, Frozen Margarita)
- Sources: <https://apollo-magazine.com/history-of-the-champagne-coupe/> · <https://www.snopes.com/fact-check/palace-coupe/> · <https://kindredcocktails.com/cocktail/beachcombers-gold>

**Nick & Nora glass** · about 5 oz · takes up

A small, deep 1930s bowl sold as the "Little Martini". Dale DeGroff revived it at the Rainbow Room in 1987 and named it after Nick and Nora Charles of The Thin Man.

- Classics: Daiquiri (Sunken Harbor Club)
- In the catalogue: 10 drinks (e.g. Daiquiri, Our Man in Havana, Pagan Breakfast)
- Sources: <https://en.wikipedia.org/wiki/Nick_&_Nora_(glass)> · <https://punchdrink.com/articles/nick-nora-cocktail-glass-recommendations/>

**Cocktail glass** · about 6 oz · takes up

The straight-sided V, popularly dated to the 1925 Paris Exposition that named Art Deco. It pushed the coupe aside after the war and swelled to 10 oz and more by the 1990s. Older tiki books use it wherever they say "cocktail glass".

- Classics: El Presidente, Mary Pickford, Daiquiri No. 1
- In the catalogue: 60 drinks (e.g. Hemingway Daiquiri, El Presidente, Mary Pickford)
- Sources: <https://vinepair.com/articles/martini-glass-history/>

**Rocks glass** · about 8 oz · takes rocks

The short, heavy tumbler named for the Old Fashioned cocktail of the 1880s. In the islands it is the glass for a Ti' Punch, often with no ice at all: each drinker builds their own.

- Classics: Ti' Punch, Caipirinha, Rum Old Fashioned
- In the catalogue: 27 drinks (e.g. Ti' Punch, Bombo, Grog)
- Sources: <https://en.wikipedia.org/wiki/Old_fashioned_glass> · <https://en.wikipedia.org/wiki/Ti%27_punch>

**Double old fashioned** · about 14 oz · takes rocks, crushed

Trader Vic's own guide builds the Mai Tai over shaved ice "in a mai tai (double old-fashioned) glass", which is why bartenders still call it the Mai Tai glass. Don the Beachcomber poured the Navy Grog and Test Pilot into one too, the Grog around a cone of shaved ice with the straw through its heart.

- Classics: Mai Tai, Navy Grog, Test Pilot, Jet Pilot, Ancient Mariner
- In the catalogue: 137 drinks (e.g. Mai Tai)
- Sources: <https://www.diffordsguide.com/cocktails/recipe/1219/mai-tai-trader-vics> · <https://tradervics.com/products/tapa-mai-tai-glass> · <https://www.gastronomblog.com/navy-grog-recipe/>

**Highball** · about 10 oz · takes rocks, crushed

The straight tumbler for a spirit and its mixer, an American term from the 1890s, shorter and wider than a collins.

- Classics: Dark 'n Stormy, Mojito, Cuba Libre
- In the catalogue: 38 drinks (e.g. Mojito, Piña Colada, Cuba Libre)
- Sources: <https://www.foodrepublic.com/1549514/difference-highball-collins-cocktail-glass/> · <https://en.wikipedia.org/wiki/Dark_%27n%27_stormy>

**Collins glass** · about 13 oz · takes rocks, crushed

Named for the Tom Collins, the 19th-century gin sour lengthened with soda: taller and narrower than a highball. Swizzles go in one until the outside frosts.

- Classics: Queen's Park Swizzle, Chartreuse Swizzle, Planter's Punch, Lost Lake
- In the catalogue: 188 drinks (e.g. Piña Colada, Planter's Punch)
- Sources: <https://en.wikipedia.org/wiki/Queen%27s_Park_Swizzle> · <https://en.wikipedia.org/wiki/Chartreuse_swizzle>

**Chimney (Zombie) glass** · about 13.5 oz · takes crushed, rocks

The tallest, narrowest tumbler behind the bar, named for an oil-lamp chimney. It is the glass of Don the Beachcomber's Zombie (Hollywood, 1934), which the house limited to two per customer; Libbey's #115 "Zombie" is 13.5 oz and 7 inches tall. Trader Vic specified a 14 oz chimney for his Tortuga.

- Classics: Zombie, Tortuga
- In the catalogue: 13 drinks (e.g. Zombie)
- Sources: <https://en.wikipedia.org/wiki/Zombie_(cocktail)> · <https://www.webstaurantstore.com/libbey-115-straight-sided-13-5-oz-zombie-glass-case/551115.html> · <https://en.wikipedia.org/wiki/Tortuga_(cocktail)>

**Hurricane glass** · about 20 oz · takes crushed, frozen, rocks

Pat O'Brien's in New Orleans poured its 1940s Hurricane into a 26 oz glass shaped like a hurricane lamp, reportedly to move the rum distributors forced on bars in exchange for scarce whiskey. The glass became the souvenir, and the shape became the resort-drink standard.

- Classics: Hurricane, Blue Hawaii, Bahama Mama, Tropical Itch, Piña Colada (Caribe Hilton today)
- In the catalogue: 49 drinks (e.g. Hurricane)
- Sources: <https://en.wikipedia.org/wiki/Hurricane_glass> · <https://neworleanshistorical.org/items/show/1182> · <https://shop.patobriens.com/pob-hurricane-glass.html>

**Poco grande** · about 12 oz · takes frozen, crushed

Libbey's "little big": a smaller, longer-stemmed cousin of the hurricane with a tulip bowl and a softly flared lip. The frozen Piña Colada glass, and the shape of the tropical-drink emoji.

- Classics: Piña Colada, Chi Chi, frozen daiquiris
- In the catalogue: 0 drinks
- Sources: <https://www.webstaurantstore.com/libbey-3715-embassy-10-5-oz-poco-grande-glass-case/5513715.html>

**Footed pilsner** · about 12 oz · takes crushed, rocks

A slender cone of a beer glass on a short foot. Don the Beachcomber used it for his tall swizzle-style drinks: Three Dots and a Dash, the Port au Prince and the Nui Nui (his notebook calls it the Pupule). Navy Grog ice cones are packed in one.

- Classics: Three Dots and a Dash, Nui Nui, Port au Prince
- In the catalogue: 38 drinks (e.g. Queen's Park Swizzle, Barbados Rum Punch, Three Dots and a Dash)
- Sources: <https://www.wineandspiritsmagazine.com/recipes/three-dots-and-a-dash> · <https://www.webstaurantstore.com/libbey-12-oz-footed-pilsner-glass-sample/9993812SMP.html> · <https://cocktailpartyapp.com/drinks/pupule/>

**Pearl Diver glass** · about 12 oz · takes crushed

A footed tumbler with a ribbed column that flares into a coupe-like bowl, used by Don the Beachcomber for the Pearl Diver (first the Pearl Diver's Punch, late 1930s). Breakage and theft had nearly wiped it out by the 1970s; Jeff Berry and Cocktail Kingdom brought it back.

- Classics: Pearl Diver
- In the catalogue: 2 drinks (e.g. Pearl Diver)
- Sources: <https://beachbumberry.com/barware-pearl-diver-glass.html> · <https://cocktailkingdom.com/products/pearl-diver-glass-12oz-360ml-4-pack>

**Tiki snifter** · about 20 oz · takes crushed

The brandy balloon, blown up to 16–26 oz for mid-century showpieces. The Sidewinder's Fang, from The Lanai in San Mateo, comes in one with a long spiral of orange peel coiled inside like a snake.

- Classics: Sidewinder's Fang, Mai Tai (some bars)
- In the catalogue: 37 drinks (e.g. Missionary's Downfall, Cobra's Fang, Message in a Bottle)
- Sources: <https://subtletiki.com/sidewinders-fang/> · <https://en.wikipedia.org/wiki/Snifter>

**Tulip (sling) glass** · about 11 oz · takes crushed, rocks

The tall, stemmed sling glass. Raffles in Singapore serves Ngiam Tong Boon's Singapore Sling (c. 1915) in its own version and sells it as a souvenir; bars elsewhere reach for a collins or a hurricane.

- Classics: Singapore Sling
- In the catalogue: 7 drinks (e.g. Singapore Sling, Major Bailey #2)
- Sources: <https://en.wikipedia.org/wiki/Singapore_sling> · <https://www.rafflesarcade.com.sg/product/raffles-singapore-sling-glass>

**Goblet** · about 12 oz · takes crushed, frozen

A generic stemmed glass with a deep round bowl and a sturdy stem: the fallback for frozen drinks. No tiki classic belongs to it by right.

- Classics: frozen daiquiris
- In the catalogue: 14 drinks (e.g. Piña Colada, Scorpion, Banzai Washout)
- Sources: <https://en.wikipedia.org/wiki/List_of_glassware>

**Champagne flute** · about 7 oz · takes up

The tall champagne glass of 18th-century England, which keeps bubbles longer than a coupe. It suits the champagne-topped exotics.

- Classics: Sparkling Mai Tai
- In the catalogue: 7 drinks (e.g. Daiquiri, Richard Sealebach, Sparkling Mai Tai)
- Sources: <https://en.wikipedia.org/wiki/Champagne_glass>

**Irish coffee glass** · about 8 oz · takes hot

The Buena Vista in San Francisco has served Irish Coffee since 1952 in Libbey's 6 oz Georgian glass. Its stemmed, handled cousins became the hot-drink glass of tiki bars; Smuggler's Cove pours Hot Buttered Rum into one.

- Classics: Hot Buttered Rum, Coffee Grog
- In the catalogue: 6 drinks (e.g. Hot Buttered Rum, Coffee Grog, Spontaneous Rumbustion)
- Sources: <https://www.sfgate.com/news/article/The-Irish-coffee-miracle-A-San-Francisco-story-2354499.php> · <https://en.wikipedia.org/wiki/Hot_buttered_rum>

### Metal

**Julep cup** · about 11 oz · takes crushed

The silver or pewter cup of Kentucky julep culture (Asa Blanchard's, 1808–1838, are the prized ones). Metal carries the cold, so the outside frosts white when it is packed with crushed ice.

- Classics: Rum Julep, 151 Swizzle
- In the catalogue: 4 drinks (e.g. Rum Julep, 151 Swizzle, Tequi La Banane)
- Sources: <https://www.julepcups.com/julep-cup-history/>

**Copper mug** · about 14 oz · takes rocks, crushed

The Moscow Mule's mug, from the Cock 'n' Bull in Los Angeles, 1941. Who brought the copper is disputed; the hammered, riveted mug is not.

- Classics: Moscow Mule, Jamaican Mule
- In the catalogue: 1 drink (e.g. Jamaican Mule)
- Sources: <https://en.wikipedia.org/wiki/Moscow_mule>

**Enamel tin mug** · about 12 oz · takes crushed, rocks

The Soggy Dollar Bar on Jost Van Dyke served the first Painkillers in plastic cups. Pusser's Rum, which trademarked the drink in 1989, made it the white enamel mug with the navy rim, a nod to the Royal Navy's rum ration.

- Classics: Painkiller
- In the catalogue: 1 drink (e.g. Painkiller)
- Sources: <https://pussersrum.com/products/pussers-rum-tin-mug> · <https://en.wikipedia.org/wiki/Painkiller_(cocktail)>

### Tiki ceramics

**Tiki mug** · about 14 oz · takes crushed, frozen

The classic Ku mug: heavy brow, huge eyes and a grin full of square teeth, after Kū, the Hawaiian god of war. Orchids of Hawaii's R-71 and Otagiri's versions filled tiki bars from the late 1950s; Tiki Farm reissues the form today. When a recipe just says "tiki mug", this is the one.

- Classics: Cobra's Fang, Donga Punch, Lapu Lapu
- In the catalogue: 67 drinks (e.g. Pina Colada, Rum Runner, Cobra's Fang)
- Sources: <https://en.wikipedia.org/wiki/Tiki_mug> · <https://mytiki.life/creators/orchids-of-hawaii/tiki-mugs>

**Moai mug** · about 16 oz · takes crushed, frozen

The Easter Island head, one of the most common tiki mugs, carried in on Thor Heyerdahl's Kon-Tiki (1947) and Aku-Aku (1957). Orchids of Hawaii's R-72 is tan with coffee-bean eyes; the Kahiki's Mug No. 1 is a brown moai.

- Classics: Kahiki house drinks
- In the catalogue: 0 drinks
- Sources: <https://en.wikipedia.org/wiki/Tiki_mug> · <https://thesearchfortiki.com/tiki-mug/kahiki-moai-mug-no-1-kahiki-supper-club-open-edition/>

**Skull mug** · about 12 oz · takes crushed

Trader Vic's 1947 guide pictures a bone-white ceramic skull with a bone handle for Hot Buttered Rum and Coffee Grog. The Mai-Kai has served its Shrunken Skull since opening night in 1956 (in a shrunken-head mug by Al Kocab).

- Classics: Shrunken Skull
- In the catalogue: 3 drinks (e.g. Shrunken Skull, Day of the Dead, Muertito Vivo)
- Sources: <https://www.collectorsweekly.com/stories/212007-different-skull-mugs-made-for-trader-vi> · <https://mytiki.life/tiki-mugs/mai-kai-shrunken-head-mug-vintage>

**Rum barrel mug** · about 16 oz · takes crushed

Donn Beach's Rum Barrel of the 1940s came in a barrel, and so did Steve Crane's at the Luau. The Mai-Kai's Barrel O' Rum, by Donn's former bartender Mariano Licudine, has been its best-selling mug since 1956: brown wood-grain glaze, four bands.

- Classics: Rum Barrel, Barrel O' Rum
- In the catalogue: 5 drinks (e.g. Rum Barrel, Barrel O' Rum, Rum Keg)
- Sources: <https://www.slammie.com/atomicgrog/blog/2011/06/27/the-rum-barrel-the-rodney-dangerfield-of-tropical-drinks/> · <https://mytiki.life/tiki-mugs/mai-kai-barrel-o-rum>

**Fog Cutter mug** · about 20 oz · takes crushed, rocks

One of Trader Vic's first ceramics, pictured in Life in 1944: a tall, slightly waisted, sand-glazed mug with a hula girl, a ukulele player and a beach bum in relief. The Fog Cutter ("positively only two to a person") and the gentler 1950s Samoan Fog Cutter both come in it.

- Classics: Fog Cutter, Samoan Fog Cutter
- In the catalogue: 4 drinks (e.g. Fog Cutter, Samoan Fog Cutter)
- Sources: <https://tradervics.com/products/fogcutter-mug> · <https://mytiki.life/tiki-mugs/trader-vics-fog-cutter-sand> · <https://en.wikipedia.org/wiki/Fog_Cutter>

**Bird-shaped ceramic** · about 12 oz · takes rocks, crushed

Jeffrey Ong created the Jungle Bird at the Kuala Lumpur Hilton's Aviary Bar in 1973 and served it in a ceramic bird. Craft bars pour it over a big cube in a rocks glass now; the bird is the original.

- Classics: Jungle Bird (1973), Potted Parrot
- In the catalogue: 2 drinks (e.g. Jungle Bird, Potted Parrot)
- Sources: <https://en.wikipedia.org/wiki/Jungle_Bird> · <https://thirstmag.com/drinks/The-story-of-Jungle-Bird-cocktail>

**Clay cup** · about 7 oz · takes rocks

The canchánchara (aguardiente, honey and lime) goes back to Cuba's independence fighters, who drank it hot from gourds. In Trinidad, Cuba, the La Canchánchara tavern serves it cold in small cups from the town's potteries.

- Classics: Canchánchara
- In the catalogue: 1 drink (e.g. Canchánchara)
- Sources: <https://oncubanews.com/en/cuba/society-cuba/cuban-history/canchanchara-scrubland-cocktail/>

**Toddy mug** · about 10 oz · takes hot

The handled mug for hot drinks, descended from the milk-glass Tom & Jerry mugs of the 1940s–60s. Preheat it with boiling water so the drink stays hot.

- Classics: Hot Buttered Rum, Hot Rum Punch, Tom & Jerry
- In the catalogue: 4 drinks (e.g. Hot Buttered Rum, Hot Grog, Hot Rum Punch)
- Sources: <https://punchdrink.com/articles/about-those-tom-and-jerry-drink-recipe-bowls/>

### Fruit

**Coconut shell** · about 12 oz · takes crushed, frozen

Don the Beachcomber's 1930s menu put coconut drinks in green coconuts, one of only two exceptions to his glassware. Ceramic half-shell mugs followed; Jeff Berry's Coconaut (1998) is poured into them.

- Classics: Coconaut, Wahine, Moonkist Coconut
- In the catalogue: 5 drinks (e.g. Funky Monkey, Wahine, Monk's Respite)
- Sources: <https://en.wikipedia.org/wiki/Tiki_mug> · <https://rumdood.com/2010/03/18/coconaut/>

**Hollowed pineapple** · about 20 oz · takes crushed, frozen

The other exception on Donn Beach's 1930s menu: the Pi Yi, blended with the fruit scooped out of a baby pineapple and poured back into the shell. Disney's Polynesian Village made the Lapu Lapu its pineapple drink.

- Classics: Pi Yi, Lapu Lapu
- In the catalogue: 6 drinks (e.g. Pina Colada, Abacaxi Ricaço, The Mastadon)
- Sources: <https://vintageamericancocktails.com/pi-yi/> · <https://en.wikipedia.org/wiki/Tiki_mug>

### Bowls

**Scorpion bowl** · about 64 oz · takes bowl, crushed

Trader Vic found the Scorpion at The Hut in Honolulu and was serving it by the bowl by 1944. The perfected bowl stands on three kneeling hula girls, carries island scenes in relief, and arrives with four long straws and a floating gardenia; today's holds 70 oz for four.

- Classics: Scorpion Bowl, Scorpion (batch)
- In the catalogue: 3 drinks (e.g. Scorpion Bowl, Cherie Valentino)
- Sources: <https://en.wikipedia.org/wiki/Scorpion_bowl> · <https://www.thedailybeast.com/the-mysterious-origins-of-tiki-classic-the-scorpion-bowl/> · <https://tradervics.com/products/scorpion-bowl>

**Tiki Bowl** · about 32 oz · takes bowl, crushed

Trader Vic's 1968 menu: "a delightful punch served in earthen bowl supported by three Tikis, replicas of authentic Tahitian gods", for two. The Kava Bowl for four and the Mai-Kai's tiki-faced Mystery bowl are its relatives.

- Classics: Tiki Bowl, Kava Bowl, Mystery Drink
- In the catalogue: 5 drinks (e.g. Tiki Bowl, Scorpion, Pahoehoe)
- Sources: <https://tradervics.com/products/tiki-bowl> · <https://tikicentral.com/viewtopic.php?topic_id=12387>

**Volcano bowl** · about 40 oz · takes bowl, crushed

A dark-glazed bowl with a cone rising from its middle; overproof rum goes in the crater and is set alight. Said to come from 1950s–60s Hawaii; Don the Beachcomber's St. Paul restaurant (1966) is an early documented home.

- Classics: Volcano Bowl, Flaming Volcano
- In the catalogue: 1 drink (e.g. Top Notch Volcano)
- Sources: <https://en.wikipedia.org/wiki/Volcano_bowl> · <https://en.wikipedia.org/wiki/Flaming_volcano>

**Punch bowl** · about 120 oz · takes bowl

The pressed-glass punch bowl of 1950s home entertaining: a footed bowl, a ladle and a dozen small cups hung from the rim. The right home for a batch of Planter's Punch or Vic's twelve-person Scorpion.

- Classics: Fish House Punch, Scorpion (12-person batch)
- In the catalogue: 23 drinks (e.g. Scorpion, Fish House Punch, Antilles Jewel)
- Sources: <https://www.truelegacyhomes.com/blog/antique-punch-bowls>

<!--/VESSELS-->

## Drawing notes

The drawing rules are in [art-direction.md](art-direction.md). Each vessel is one catalog part in `web/lib/artcatalog.js`.

- **Clear glasses** are profiles: half-widths from rim to floor, shared with the liquid, ice and fizz, so the drink always fills the right shape.
- **Opaque vessels** (ceramics, metal, fruit) show the drink only at the rim, with the ice heaped above it.
- **The ceramics** follow the references:
  - the Ku mug's brow, ringed eyes, square-toothed grin and folded arms;
  - the Moai's brow shelf, coffee-bean eyes and long ears;
  - the Trader Vic's skull's bone handle;
  - the Mai-Kai barrel's four hoops;
  - the Fog Cutter mug's waist and relief hula girl;
  - the Pusser's tin's navy lip;
  - the Scorpion bowl's kneeling supports;
  - the Tiki Bowl's three tikis;
  - the volcano bowl's dark glaze and lava drips.
