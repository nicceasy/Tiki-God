// Prompt → intent. A hand-built lexicon maps words and phrases to flavor tags,
// spirits, specific ingredients, families, styles and moods. Negations
// ("no coconut", "without pineapple", "not too sweet") flip the effect.

// Effect keys:
//   tags: {flavorTag: weight}        ings: {ingredientId: weight}
//   spirits: [ingredientId]          fam: {familyId: weight}
//   strength / sweetness / tartness / complexity: -2..+2
//   style: {hot, creamy, long, stirred, frozen, flaming, bowl, bitter, zeroProof, simple, classic, modern}
//   color: 'blue' | 'red' | ...      label: human phrase used in the explanation
export const LEXICON = [
  // ---- spirits ----
  { k: ['rum', 'rhum', 'ron'], spirits: ['rum'], label: 'rum' },
  { k: ['jamaican', 'jamaica', 'hampden', 'smith and cross', 'smith & cross', 'appleton'], ings: { 'rum-jamaican-aged': 1.5 }, tags: { funky: 1 }, label: 'Jamaican rum' },
  { k: ['pot still', 'pot-still', 'high ester', 'hogo', 'dunder'], ings: { 'rum-jamaican-pot': 2 }, tags: { funky: 2 }, label: 'pot-still funk' },
  { k: ['demerara', 'guyana', 'guyanese', 'el dorado'], ings: { 'rum-demerara': 2 }, tags: { molasses: 1 }, label: 'Demerara rum' },
  { k: ['agricole', 'martinique', 'guadeloupe', 'cane juice', 'rhum agricole'], ings: { 'rum-agricole-blanc': 1, 'rum-agricole-vieux': 1 }, tags: { grassy: 1.5 }, label: 'rhum agricole' },
  { k: ['cachaca', 'cachaça', 'brazil', 'brazilian'], spirits: ['rum-cachaca'], tags: { grassy: 1 }, label: 'cachaça' },
  { k: ['navy rum', 'pussers', "pusser's", 'navy strength'], ings: { 'rum-navy': 2 }, label: 'navy rum' },
  { k: ['overproof', '151', 'high proof', 'high-proof', 'cask strength'], ings: { 'rum-demerara-overproof': 1.5 }, strength: 1, label: 'overproof' },
  { k: ['barbados', 'bajan', 'mount gay', 'foursquare'], ings: { 'rum-barbados': 2 }, label: 'Barbados rum' },
  { k: ['white rum', 'light rum', 'silver rum', 'cuban rum', 'puerto rican rum', 'bacardi'], ings: { 'rum-white-column': 2 }, label: 'light rum' },
  { k: ['dark rum'], ings: { 'rum-jamaican-dark': 1.5 }, label: 'dark rum' },
  { k: ['black rum', 'blackstrap', 'black strap', 'goslings'], ings: { 'rum-black-blended': 2 }, tags: { molasses: 1 }, label: 'black rum' },
  { k: ['spiced rum'], ings: { 'rum-spiced': 2 }, label: 'spiced rum' },
  { k: ['pineapple rum', 'stiggins'], ings: { 'rum-pineapple': 2 }, label: 'pineapple rum' },
  { k: ['haitian', 'haiti', 'barbancourt'], ings: { 'rum-haitian': 2 }, label: 'Haitian rum' },
  { k: ['tequila'], spirits: ['tequila-blanco'], tags: { agave: 1 }, label: 'tequila' },
  { k: ['reposado', 'aged tequila'], spirits: ['tequila-reposado'], tags: { agave: 1 }, label: 'reposado tequila' },
  { k: ['mezcal', 'mescal'], spirits: ['mezcal'], tags: { smoky: 1, agave: 1 }, label: 'mezcal' },
  { k: ['gin', 'juniper'], spirits: ['gin'], label: 'gin' },
  { k: ['old tom'], spirits: ['gin-old-tom'], label: 'Old Tom gin' },
  { k: ['bourbon', 'whiskey', 'whisky', 'kentucky'], spirits: ['bourbon'], label: 'bourbon' },
  { k: ['rye'], spirits: ['rye'], label: 'rye' },
  { k: ['scotch'], spirits: ['scotch-blended'], label: 'Scotch' },
  { k: ['islay', 'peated', 'peaty', 'peat', 'laphroaig', 'ardbeg'], ings: { 'scotch-islay': 2 }, tags: { smoky: 1.5 }, label: 'peated Scotch' },
  { k: ['irish whiskey'], spirits: ['irish-whiskey'], label: 'Irish whiskey' },
  { k: ['brandy', 'cognac', 'armagnac'], spirits: ['brandy'], label: 'brandy' },
  { k: ['apple brandy', 'applejack', 'calvados'], spirits: ['applejack'], tags: { apple: 1 }, label: 'apple brandy' },
  { k: ['pisco'], spirits: ['pisco'], label: 'pisco' },
  { k: ['vodka'], spirits: ['vodka'], label: 'vodka' },
  { k: ['aquavit', 'akvavit'], spirits: ['aquavit'], label: 'aquavit' },
  { k: ['arrack', 'arak'], spirits: ['batavia-arrack'], label: 'Batavia arrack' },

  // ---- named modifiers people ask for ----
  { k: ['falernum'], ings: { 'velvet-falernum': 3 }, label: 'falernum' },
  { k: ['orgeat'], ings: { orgeat: 3 }, tags: { almond: 1 }, label: 'orgeat' },
  { k: ['allspice dram', 'pimento dram', 'allspice'], ings: { 'allspice-dram': 2 }, tags: { allspice: 1.5 }, label: 'allspice' },
  { k: ['campari'], ings: { campari: 3 }, tags: { bitter: 1 }, style: { bitter: true }, label: 'Campari' },
  { k: ['aperol'], ings: { aperol: 3 }, tags: { bitter: 0.5 }, label: 'Aperol' },
  { k: ['amaro', 'averna', 'montenegro'], ings: { amaro: 3 }, tags: { bitter: 1 }, style: { bitter: true }, label: 'amaro' },
  { k: ['cynar'], ings: { cynar: 3 }, tags: { bitter: 1 }, label: 'Cynar' },
  { k: ['fernet'], ings: { fernet: 3 }, tags: { bitter: 1, mint: 0.5 }, label: 'Fernet' },
  { k: ['chartreuse'], ings: { 'green-chartreuse': 3 }, tags: { herbal: 1.5 }, label: 'Chartreuse' },
  { k: ['yellow chartreuse'], ings: { 'yellow-chartreuse': 3 }, label: 'yellow Chartreuse' },
  { k: ['benedictine', 'bénédictine'], ings: { benedictine: 3 }, label: 'Bénédictine' },
  { k: ['maraschino', 'luxardo'], ings: { maraschino: 3 }, label: 'maraschino' },
  { k: ['curacao', 'curaçao', 'cointreau', 'triple sec', 'grand marnier'], ings: { 'orange-curacao': 2 }, tags: { orange: 1 }, label: 'orange curaçao' },
  { k: ['blue curacao', 'blue curaçao'], ings: { 'blue-curacao': 3 }, color: 'blue', label: 'blue curaçao' },
  { k: ['galliano'], ings: { galliano: 3 }, label: 'Galliano' },
  { k: ['st germain', 'st-germain', 'elderflower'], ings: { 'elderflower-liqueur': 3 }, tags: { floral: 1 }, label: 'elderflower' },
  { k: ['absinthe', 'pernod', 'herbsaint', 'pastis'], ings: { absinthe: 2 }, tags: { anise: 1.5 }, label: 'absinthe' },
  { k: ['angostura', 'bitters'], ings: { angostura: 1 }, label: 'bitters' },
  { k: ['grenadine'], ings: { grenadine: 3 }, label: 'grenadine' },
  { k: ['sherry'], ings: { 'amontillado-sherry': 2 }, label: 'sherry' },
  { k: ['port wine', 'ruby port'], ings: { 'ruby-port': 2 }, label: 'port' },
  { k: ['vermouth'], ings: { 'sweet-vermouth': 2 }, label: 'vermouth' },
  { k: ['champagne', 'prosecco', 'cava', 'sparkling wine', 'bubbles'], ings: { 'sparkling-wine': 3 }, style: { long: true }, tags: { effervescent: 1 }, label: 'sparkling wine' },
  { k: ['ginger beer'], ings: { 'ginger-beer': 3 }, style: { long: true }, tags: { ginger: 1 }, label: 'ginger beer' },
  { k: ['ginger ale'], ings: { 'ginger-ale': 3 }, style: { long: true }, label: 'ginger ale' },
  { k: ['cola', 'coke'], ings: { cola: 3 }, style: { long: true }, label: 'cola' },
  { k: ['tonic'], ings: { tonic: 3 }, style: { long: true }, label: 'tonic' },
  { k: ['ancho reyes', 'chile liqueur', 'chili liqueur'], ings: { 'ancho-reyes': 3 }, tags: { chili: 1 }, label: 'chile liqueur' },
  { k: ['kahlua', 'kahlúa', 'coffee liqueur'], ings: { 'coffee-liqueur': 3 }, tags: { coffee: 1 }, label: 'coffee liqueur' },
  { k: ['cream of coconut', 'coco lopez', 'coco lópez'], ings: { 'coconut-cream': 3 }, tags: { coconut: 1 }, label: 'cream of coconut' },
  { k: ['coconut water'], ings: { 'coconut-water': 3 }, label: 'coconut water' },
  { k: ['egg white', 'foam', 'frothy'], ings: { 'egg-white': 2 }, label: 'egg-white foam' },

  // ---- fruit ----
  { k: ['coconut', 'coco', 'copra'], tags: { coconut: 2 }, label: 'coconut' },
  { k: ['pineapple', 'pina', 'piña', 'ananas'], tags: { pineapple: 2 }, label: 'pineapple' },
  { k: ['passion fruit', 'passionfruit', 'passion-fruit', 'lilikoi', 'liliko\'i', 'maracuya', 'maracujá', 'maracuja', 'passion'], tags: { 'passion-fruit': 2 }, label: 'passion fruit' },
  { k: ['guava'], tags: { guava: 2 }, label: 'guava' },
  { k: ['mango'], tags: { mango: 2 }, label: 'mango' },
  { k: ['papaya'], tags: { papaya: 2 }, label: 'papaya' },
  { k: ['banana', 'bananas'], tags: { banana: 2 }, label: 'banana' },
  { k: ['cherry', 'cherries'], tags: { cherry: 2 }, label: 'cherry' },
  { k: ['strawberry', 'strawberries'], tags: { berry: 2 }, ings: { strawberry: 2 }, label: 'strawberry' },
  { k: ['raspberry', 'raspberries'], tags: { berry: 2 }, ings: { 'raspberry-syrup': 2 }, label: 'raspberry' },
  { k: ['blackberry', 'blackberries'], tags: { berry: 2 }, ings: { 'blackberry-liqueur': 2 }, label: 'blackberry' },
  { k: ['cassis', 'blackcurrant', 'black currant'], ings: { 'creme-de-cassis': 3 }, tags: { berry: 1 }, label: 'cassis' },
  { k: ['berry', 'berries'], tags: { berry: 2 }, label: 'berries' },
  { k: ['apricot'], tags: { apricot: 2 }, label: 'apricot' },
  { k: ['peach', 'peaches'], tags: { peach: 2 }, label: 'peach' },
  { k: ['stone fruit'], tags: { 'stone-fruit': 2 }, label: 'stone fruit' },
  { k: ['pomegranate'], tags: { pomegranate: 2 }, label: 'pomegranate' },
  { k: ['apple', 'apples', 'cider'], tags: { apple: 2 }, label: 'apple' },
  { k: ['watermelon', 'melon'], tags: { melon: 2 }, label: 'melon' },
  { k: ['lychee', 'litchi', 'lichee'], tags: { lychee: 2 }, label: 'lychee' },
  { k: ['cranberry'], ings: { 'cranberry-juice': 3 }, tags: { berry: 1 }, label: 'cranberry' },
  { k: ['orange', 'oranges', 'oj'], tags: { orange: 2 }, label: 'orange' },
  { k: ['grapefruit'], tags: { grapefruit: 2 }, label: 'grapefruit' },
  { k: ['lime', 'limes'], tags: { lime: 1.5 }, label: 'lime' },
  { k: ['lemon', 'lemons'], tags: { lemon: 2 }, label: 'lemon' },
  { k: ['yuzu'], ings: { 'yuzu-juice': 3 }, tags: { citrus: 1 }, label: 'yuzu' },
  { k: ['citrus', 'citrusy', 'zesty', 'zingy'], tags: { citrus: 2 }, label: 'citrus' },
  { k: ['fruity', 'juicy', 'fruit'], tags: { fruity: 2 }, label: 'fruity' },
  { k: ['tropical', 'exotic'], tags: { tropical: 1.5 }, label: 'tropical' },
  { k: ['dried fruit', 'raisin', 'fig'], tags: { 'dried-fruit': 2 }, label: 'dried fruit' },

  // ---- spice & aromatics ----
  { k: ['cinnamon'], tags: { cinnamon: 2 }, label: 'cinnamon' },
  { k: ['clove', 'cloves'], tags: { clove: 2 }, label: 'clove' },
  { k: ['nutmeg'], tags: { nutmeg: 2 }, label: 'nutmeg' },
  { k: ['vanilla'], tags: { vanilla: 2 }, label: 'vanilla' },
  { k: ['ginger', 'gingery'], tags: { ginger: 2 }, label: 'ginger' },
  { k: ['spice', 'spiced', 'baking spice', 'warm spice', 'warming', 'christmas spice', 'pumpkin spice'], tags: { 'baking-spice': 2, cinnamon: 0.5, allspice: 0.5 }, label: 'warm spice' },
  { k: ['spicy'], tags: { chili: 1.5, ginger: 0.8, 'baking-spice': 0.8 }, label: 'spicy' },
  { k: ['chai'], tags: { 'baking-spice': 2, tea: 1, ginger: 1 }, label: 'chai spice' },
  { k: ['anise', 'aniseed', 'licorice', 'liquorice', 'fennel', 'star anise'], tags: { anise: 2 }, label: 'anise' },
  { k: ['chili', 'chile', 'chilli', 'jalapeno', 'jalapeño', 'habanero', 'serrano', 'heat', 'fiery', 'kick', 'burn', 'hot sauce'], tags: { chili: 2 }, label: 'chili heat' },
  { k: ['peppery', 'black pepper'], tags: { pepper: 2 }, label: 'pepper' },
  { k: ['mint', 'minty', 'spearmint'], tags: { mint: 2 }, label: 'mint' },
  { k: ['basil'], ings: { basil: 2 }, tags: { herbal: 1 }, label: 'basil' },
  { k: ['cucumber'], ings: { cucumber: 2 }, label: 'cucumber' },
  { k: ['herbal', 'herby', 'herbs', 'botanical', 'garden'], tags: { herbal: 2 }, label: 'herbal' },
  { k: ['floral', 'flower', 'flowers', 'blossom', 'perfumed'], tags: { floral: 2 }, label: 'floral' },
  { k: ['hibiscus', 'sorrel', 'jamaica flower'], ings: { 'hibiscus-syrup': 3 }, tags: { floral: 1 }, label: 'hibiscus' },
  { k: ['orange blossom', 'orange flower'], ings: { 'orange-flower-water': 2 }, tags: { floral: 1 }, label: 'orange blossom' },
  { k: ['almond', 'almonds', 'marzipan', 'nutty', 'nuts'], tags: { almond: 1.5, nutty: 1 }, label: 'nutty' },
  { k: ['hazelnut'], ings: { 'hazelnut-liqueur': 3 }, tags: { nutty: 1 }, label: 'hazelnut' },
  { k: ['honey', 'honeyed'], tags: { honey: 2 }, label: 'honey' },
  { k: ['maple'], tags: { maple: 2 }, label: 'maple' },
  { k: ['caramel', 'toffee', 'butterscotch', 'brown sugar', 'burnt sugar'], tags: { caramel: 2 }, label: 'caramel' },
  { k: ['molasses', 'treacle'], tags: { molasses: 2 }, label: 'molasses' },
  { k: ['buttery', 'butter', 'buttered'], tags: { buttery: 2 }, label: 'buttery' },
  { k: ['chocolate', 'cacao', 'cocoa', 'mocha'], tags: { chocolate: 2 }, label: 'chocolate' },
  { k: ['coffee', 'espresso', 'cold brew', 'java'], tags: { coffee: 2 }, label: 'coffee' },
  { k: ['tea', 'black tea'], tags: { tea: 2 }, label: 'tea' },
  { k: ['salt', 'salty', 'savory', 'savoury', 'briny', 'saline'], tags: { salty: 2 }, label: 'savory salt' },
  { k: ['earthy'], tags: { earthy: 2 }, label: 'earthy' },

  // ---- character ----
  { k: ['funky', 'funk', 'estery', 'esters', 'overripe'], tags: { funky: 2.5 }, label: 'funk' },
  { k: ['grassy', 'vegetal', 'green cane'], tags: { grassy: 2.5 }, label: 'grassy' },
  { k: ['smoky', 'smokey', 'smoke', 'smoked', 'campfire', 'charred', 'ashy'], tags: { smoky: 2.5 }, label: 'smoke' },
  { k: ['oaky', 'woody', 'barrel', 'aged'], tags: { oaky: 1.5 }, label: 'oak' },
  { k: ['rich', 'decadent', 'indulgent', 'lush', 'luxurious', 'unctuous'], tags: { rich: 2 }, label: 'rich' },
  { k: ['creamy', 'cream', 'milkshake', 'silky', 'velvety', 'smooth', 'custard'], tags: { creamy: 2 }, style: { creamy: true }, label: 'creamy' },
  { k: ['light', 'refreshing', 'crisp', 'easy drinking', 'crushable', 'quenching', 'breezy', 'bright', 'thirst'], tags: { light: 1.5, crisp: 1 }, strength: -0.5, label: 'light & refreshing' },
  { k: ['dry', 'not sweet', 'unsweet', 'bone dry'], sweetness: -1.2, tags: { dry: 1 }, label: 'dry' },
  { k: ['sweet', 'sugary', 'candy'], sweetness: 1, label: 'sweet' },
  { k: ['tart', 'sour', 'tangy', 'puckery', 'sharp', 'acidic'], tartness: 1, tags: { tart: 1.5 }, label: 'tart' },
  { k: ['bitter', 'bittersweet', 'amaro-like'], tags: { bitter: 2 }, style: { bitter: true }, label: 'bitter' },
  { k: ['strong', 'boozy', 'potent', 'stiff', 'knock me out', 'knockout', 'deadly', 'lethal', 'powerful', 'punchy', 'high octane', 'heavy hitter', 'booze forward', 'boozeforward', 'two per customer'], strength: 1.2, tags: { boozy: 1 }, label: 'strong' },
  { k: ['weak', 'low abv', 'low-abv', 'low proof', 'low-proof', 'lighter on the booze', 'sessionable', 'session', 'day drinking', 'lunch', 'low alcohol', 'not too strong', 'easy on the alcohol'], strength: -1.2, label: 'lower-proof' },
  { k: ['fizzy', 'bubbly', 'sparkling', 'effervescent', 'carbonated', 'highball', 'soda', 'spritz', 'tall', 'long drink', 'cooler'], style: { long: true }, tags: { effervescent: 1.5 }, label: 'long & fizzy' },
  { k: ['frozen', 'blended', 'slushy', 'slushie', 'frappe', 'frappé', 'icy', 'blender'], style: { frozen: true }, label: 'frozen' },
  { k: ['flaming', 'fire', 'flame', 'on fire', 'ignite', 'set on fire', 'pyro'], style: { flaming: true }, label: 'flaming' },
  { k: ['hot drink', 'served hot', 'steaming', 'toddy', 'mulled', 'hot toddy', 'warm drink', 'hot cocktail', 'mug of', 'warm me up'], style: { hot: true }, tags: { warm: 1 }, label: 'served hot' },
  { k: ['stirred', 'spirit forward', 'spirit-forward', 'sipper', 'sipping', 'nightcap', 'old fashioned', 'manhattan', 'negroni', 'on a rock', 'big rock'], style: { stirred: true }, label: 'stirred & spirit-forward' },
  { k: ['bowl', 'share', 'sharing', 'group', 'crowd', 'party punch', 'for the table', 'volcano bowl', 'scorpion bowl'], style: { bowl: true }, label: 'shared bowl' },
  { k: ['mocktail', 'non alcoholic', 'non-alcoholic', 'alcohol free', 'alcohol-free', 'zero proof', 'zero-proof', 'virgin', 'nonalcoholic', 'sober', 'no alcohol', 'na '], style: { zeroProof: true }, label: 'zero-proof' },
  { k: ['simple', 'easy', 'easy to make', 'few ingredients', 'minimal', 'minimalist', 'pantry', 'quick', 'lazy', 'three ingredient', '3 ingredient', 'beginner'], complexity: -1.2, style: { simple: true }, label: 'simple to make' },
  { k: ['complex', 'layered', 'elaborate', 'showstopper', 'show stopper', 'crazy', 'over the top', 'maximalist', 'intricate', 'impress'], complexity: 1.2, label: 'complex & layered' },
  { k: ['classic', 'old school', 'old-school', 'vintage', 'golden age', 'traditional', 'retro', 'mid century', 'mid-century'], style: { classic: true }, label: 'old-school' },
  { k: ['modern', 'craft', 'new school', 'contemporary', 'innovative', 'unusual', 'weird', 'experimental'], style: { modern: true }, label: 'modern' },

  // ---- colors ----
  { k: ['blue', 'turquoise', 'aqua', 'azure', 'teal'], color: 'blue', ings: { 'blue-curacao': 2 }, label: 'blue' },
  { k: ['red', 'crimson', 'ruby', 'scarlet'], color: 'red', label: 'red' },
  { k: ['pink', 'rosy', 'blush'], color: 'pink', label: 'pink' },
  { k: ['green'], color: 'green', tags: { herbal: 1, mint: 0.5 }, label: 'green' },
  { k: ['golden', 'gold', 'yellow', 'sunshine', 'sunny'], color: 'gold', tags: { 'passion-fruit': 0.5, pineapple: 0.5 }, label: 'golden' },
  { k: ['purple', 'violet'], color: 'purple', tags: { berry: 1 }, label: 'purple' },
  { k: ['black', 'dark', 'midnight', 'inky', 'goth'], color: 'dark', tags: { molasses: 1 }, label: 'dark' },

  // ---- moods, seasons, places ----
  { k: ['summer', 'beach', 'pool', 'poolside', 'sun', 'vacation', 'island', 'paradise', 'luau', 'boat', 'lake day', 'hot day', 'heatwave', 'patio'], tags: { tropical: 1, fruity: 1, light: 0.8 }, label: 'summer day' },
  { k: ['winter', 'cold night', 'cold', 'christmas', 'xmas', 'holiday', 'holidays', 'cozy', 'snow', 'snowy', 'fireplace', 'fall', 'autumn', 'thanksgiving', 'november', 'december', 'rainy', 'rain'], tags: { 'baking-spice': 1.5, rich: 1, warm: 1, cinnamon: 0.5 }, label: 'cold-weather' },
  { k: ['halloween', 'spooky', 'haunted', 'creepy', 'undead', 'monster'], tags: { molasses: 1, anise: 0.8 }, strength: 0.6, fam: { zombie: 1.5 }, color: 'dark', label: 'spooky' },
  { k: ['pirate', 'sailor', 'navy', 'buccaneer', 'shipwreck', 'nautical', 'captain', 'seafaring', 'mariner'], ings: { 'rum-navy': 1 }, tags: { molasses: 1 }, strength: 0.5, fam: { grog: 1 }, label: 'nautical' },
  { k: ['romantic', 'date night', 'date', 'valentine', 'valentines', 'love', 'anniversary'], tags: { floral: 1.2, berry: 1 }, color: 'pink', label: 'romantic' },
  { k: ['brunch', 'breakfast', 'morning', 'hangover'], tags: { coffee: 0.7, orange: 1 }, strength: -0.8, label: 'brunch' },
  { k: ['dessert', 'after dinner', 'digestif', 'sweet tooth'], tags: { creamy: 1, chocolate: 0.8, rich: 1 }, sweetness: 0.4, label: 'dessert' },
  { k: ['jungle', 'rainforest', 'wild'], tags: { herbal: 1, bitter: 0.8 }, label: 'jungle' },
  { k: ['volcano', 'lava', 'eruption', 'magma', 'inferno'], tags: { chili: 0.8, smoky: 0.8 }, style: { flaming: true }, color: 'red', label: 'volcanic' },
  { k: ['sunset', 'dusk'], tags: { orange: 1, 'passion-fruit': 0.6 }, ings: { grenadine: 1.5 }, color: 'red', label: 'sunset' },
  { k: ['storm', 'stormy', 'thunder', 'monsoon', 'typhoon'], tags: { ginger: 0.8, molasses: 0.8 }, label: 'stormy' },
  { k: ['hawaii', 'hawaiian', 'aloha', 'waikiki', 'maui', 'honolulu', 'oahu', 'kona'], tags: { pineapple: 1.2, 'passion-fruit': 1, guava: 0.8, coconut: 0.5 }, label: 'Hawaiian' },
  { k: ['caribbean', 'trinidad', 'antilles', 'west indies', 'st lucia', 'grenada'], tags: { allspice: 1, lime: 0.8, funky: 0.6 }, label: 'Caribbean' },
  { k: ['bermuda'], tags: { ginger: 1.5, molasses: 1 }, fam: { buck: 1.5 }, label: 'Bermudan' },
  { k: ['cuba', 'cuban', 'havana', 'floridita'], ings: { 'rum-white-column': 1.5 }, tags: { lime: 1, mint: 0.5 }, fam: { daiquiri: 1.5 }, label: 'Cuban' },
  { k: ['puerto rico', 'san juan', 'boricua'], tags: { coconut: 1, pineapple: 1 }, label: 'Puerto Rican' },
  { k: ['mexico', 'mexican', 'oaxaca', 'oaxacan', 'jalisco'], spirits: ['tequila-blanco'], tags: { agave: 1, chili: 0.6, lime: 0.6 }, label: 'Mexican' },
  { k: ['thai', 'thailand', 'vietnam', 'vietnamese', 'southeast asian', 'bangkok'], tags: { lime: 1, coconut: 0.8, chili: 0.8, ginger: 0.8, herbal: 0.5 }, label: 'Southeast Asian' },
  { k: ['japan', 'japanese', 'tokyo'], tags: { citrus: 1, tea: 0.8, floral: 0.6 }, ings: { 'yuzu-juice': 1 }, label: 'Japanese' },
  { k: ['india', 'indian', 'masala'], tags: { tea: 1, ginger: 1, 'baking-spice': 1 }, label: 'Indian spice' },
  { k: ['new orleans', 'nola', 'bourbon street', 'mardi gras', 'louisiana'], tags: { anise: 1 }, ings: { peychauds: 1.5 }, label: 'New Orleans' },
  { k: ['tahiti', 'tahitian', 'polynesia', 'polynesian', 'south pacific', 'samoa', 'fiji', 'bora bora'], tags: { vanilla: 1, coconut: 0.8, tropical: 0.8 }, label: 'South Pacific' },
  { k: ['hong kong', 'chinese', 'china', 'canton', 'shanghai'], tags: { lychee: 1, ginger: 1, tea: 0.6 }, label: 'Chinese' },
  { k: ['philippines', 'filipino', 'manila'], tags: { mango: 1, coconut: 0.8, lime: 0.8 }, label: 'Filipino' },
  { k: ['florida', 'key west', 'miami', 'keys'], tags: { lime: 1, orange: 0.8, coconut: 0.5 }, label: 'Florida' },
  { k: ['california', 'hollywood', 'los angeles'], tags: { citrus: 0.8 }, fam: { 'beachcomber-sour': 0.8, zombie: 0.5 }, label: 'Hollywood' },
  { k: ['scandinavian', 'nordic', 'swedish', 'danish', 'norwegian'], spirits: ['aquavit'], label: 'Nordic' },
];

// Family words (also detected via drink names).
export const FAMILY_WORDS = [
  { k: ['mai tai', 'maitai'], fam: 'mai-tai' },
  { k: ['zombie'], fam: 'zombie' },
  { k: ['grog'], fam: 'grog' },
  { k: ['swizzle'], fam: 'swizzle' },
  { k: ['daiquiri', 'daiquiris'], fam: 'daiquiri' },
  { k: ['colada', 'painkiller', 'pain killer'], fam: 'colada' },
  { k: ['punch', "planter's", 'planters'], fam: 'punch' },
  { k: ['scorpion', 'fog cutter', 'fogcutter'], fam: 'orgeat-punch' },
  { k: ['buck', 'mule', 'cooler', 'dark n stormy', "dark 'n stormy", 'dark and stormy'], fam: 'buck' },
  { k: ['hurricane', 'rum runner', 'resort', 'cruise', 'swim up bar', 'swim-up bar', 'all inclusive', 'all-inclusive'], fam: 'resort-punch' },
  { k: ['jungle bird'], fam: 'bitter-tiki' },
  { k: ['old fashioned', 'stirred'], fam: 'stirred' },
  { k: ['hot buttered', 'coffee grog', 'toddy'], fam: 'hot', style: { hot: true } },
];

const NEGATORS = ['no', 'not', 'without', 'hold', 'skip', 'avoid', 'hate', 'hates', 'dislike', 'allergic', 'minus', 'never', 'zero', 'nix', 'lose', 'except', "don't", 'dont', 'less', 'fewer', 'too'];
const SOFTENERS = ['less', 'fewer', 'too', 'lighter', 'not too', 'not as'];

// Allergy / diet shortcuts → hard exclusions.
export const DIETS = [
  { k: ['nut free', 'nut-free', 'nut allergy', 'allergic to nuts', 'no nuts', 'tree nut'], exclude: ['orgeat', 'amaretto', 'hazelnut-liqueur', 'velvet-falernum', 'falernum-syrup'], label: 'nut-free' },
  { k: ['dairy free', 'dairy-free', 'no dairy', 'lactose'], exclude: ['heavy-cream', 'half-and-half', 'irish-cream', 'vanilla-ice-cream', 'butter', 'gardenia-mix', 'hot-buttered-rum-batter'], label: 'dairy-free' },
  { k: ['vegan', 'plant based', 'plant-based'], exclude: ['heavy-cream', 'half-and-half', 'irish-cream', 'vanilla-ice-cream', 'butter', 'gardenia-mix', 'hot-buttered-rum-batter', 'egg-white', 'honey-syrup'], label: 'vegan' },
  { k: ['no egg', 'egg free', 'egg-free', 'no eggs'], exclude: ['egg-white'], label: 'egg-free' },
  { k: ['no honey'], exclude: ['honey-syrup', 'gardenia-mix'], label: 'no honey' },
];

const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, eight: 8, ten: 10, twelve: 12, couple: 2, pair: 2, dozen: 12 };

export function normalizeText(s) {
  return ' ' + (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' &-]+/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';
}

function findPhrase(text, phrase) {
  const p = normalizeText(phrase).trim();
  if (!p) return [];
  const hits = [];
  let i = text.indexOf(' ' + p + ' ');
  while (i !== -1) {
    hits.push(i + 1);
    i = text.indexOf(' ' + p + ' ', i + 1);
  }
  return hits;
}

function negationBefore(text, pos) {
  const before = text.slice(Math.max(0, pos - 40), pos).trim().split(' ').slice(-4);
  // Stop at a clause boundary word: "no coconut but pineapple" must not negate pineapple.
  const boundary = before.lastIndexOf('but') > before.lastIndexOf('no') ? before.lastIndexOf('but') : -1;
  const window = boundary >= 0 ? before.slice(boundary + 1) : before;
  const neg = window.some(w => NEGATORS.includes(w));
  const soft = window.some(w => SOFTENERS.includes(w)) || / not (too|as|so) $/.test(' ' + window.join(' ') + ' ');
  return { neg, soft };
}

// Generic names are families, not specific drinks to riff on.
const GENERIC_NAMES = new Set(['grog', 'punch', 'rum punch', 'swizzle', 'rum swizzle', 'daiquiri', 'sour', 'rum sour', 'cooler', 'flip', 'rum flip', 'toddy', 'hot toddy', 'colada', 'sling', 'buck', 'fizz', 'julep', 'cobbler', 'highball', 'frozen daiquiri', 'tiki', 'bowl', 'punch bowl']);

// Build an index of drink names for "like a Painkiller" / "Mai Tai but smoky".
export function buildNameIndex(drinks) {
  const idx = [];
  const seen = new Map();
  for (const d of drinks) {
    for (const n of [d.name, ...(d.aka || [])]) {
      const key = normalizeText(n).trim();
      if (key.length < 4 || GENERIC_NAMES.has(key)) continue;
      const prev = seen.get(key);
      // Prefer the most popular, then the most confident record, then the oldest.
      const score = d.popularity * 10 + ({ high: 3, medium: 2, low: 1 }[d.confidence] || 0) - ((d.year || 2100) - 1800) / 1000;
      if (!prev || score > prev.score) seen.set(key, { key, id: d.id, score });
    }
  }
  for (const v of seen.values()) idx.push(v);
  idx.sort((a, b) => b.key.length - a.key.length);
  return idx;
}

export function parsePrompt(raw, { nameIndex = [], familyIds = [] } = {}) {
  let text = normalizeText(raw);
  const intent = {
    raw,
    tags: {}, avoidTags: {}, ings: {}, avoidIngs: new Set(), spirits: [], avoidSpirits: new Set(),
    fam: {}, strength: 0, sweetness: 0, tartness: 0, complexity: 0,
    style: {}, color: null, servings: 1, riffOf: null, riffName: null,
    matched: [], diets: [],
  };
  const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };

  // Drink names first (longest match wins, and consume the text so "zombie" isn't also a mood).
  for (const n of nameIndex) {
    const hits = findPhrase(text, n.key);
    if (!hits.length) continue;
    const { neg } = negationBefore(text, hits[0]);
    if (!neg && !intent.riffOf) {
      intent.riffOf = n.id;
      intent.riffName = n.key;
      intent.matched.push({ phrase: n.key, label: `riff on ${n.key}` });
    }
    text = text.split(' ' + n.key + ' ').join(' ');
  }

  // Diets / allergies.
  for (const d of DIETS) {
    for (const k of d.k) {
      if (findPhrase(text, k).length) {
        d.exclude.forEach(id => intent.avoidIngs.add(id));
        intent.diets.push(d.label);
        text = text.split(' ' + normalizeText(k).trim() + ' ').join(' ');
        break;
      }
    }
  }

  // Serving count: "for 4", "serves six", "for a party of 8".
  const m = text.match(/ (?:for|serves|serving|feeds|party of) (\d{1,2}|two|three|four|five|six|eight|ten|twelve|a couple|a crowd|a group) /);
  if (m) {
    const w = m[1].replace('a ', '');
    const n = NUMBER_WORDS[w] || parseInt(w, 10) || (w === 'crowd' || w === 'group' ? 6 : 2);
    if (n > 1) { intent.servings = Math.min(n, 12); intent.style.bowl = n >= 3; }
  }

  // Family words.
  for (const f of FAMILY_WORDS) {
    for (const k of f.k) {
      const hits = findPhrase(text, k);
      if (!hits.length) continue;
      const { neg } = negationBefore(text, hits[0]);
      if (neg) add(intent.fam, f.fam, -3);
      else {
        add(intent.fam, f.fam, 3);
        if (f.style) Object.assign(intent.style, f.style);
        intent.matched.push({ phrase: k, label: `${f.fam.replace('-', ' ')} family` });
      }
      text = text.split(' ' + normalizeText(k).trim() + ' ').join(' ');
      break;
    }
  }

  // Lexicon, longest phrases first so "blue curacao" beats "blue" and "ginger beer" beats "ginger".
  const entries = [];
  for (const e of LEXICON) for (const k of e.k) entries.push([normalizeText(k).trim(), e]);
  entries.sort((a, b) => b[0].length - a[0].length);
  const consumed = new Set();
  for (const [phrase, e] of entries) {
    const hits = findPhrase(text, phrase);
    if (!hits.length) continue;
    if (consumed.has(e)) { text = text.split(' ' + phrase + ' ').join(' '); continue; }
    consumed.add(e);
    const { neg, soft } = negationBefore(text, hits[0]);
    const sign = neg ? -1 : 1;
    applyEffect(intent, e, sign, soft && neg);
    intent.matched.push({ phrase, label: (neg ? (soft ? 'less ' : 'no ') : '') + (e.label || phrase) });
    text = text.split(' ' + phrase + ' ').join(' ');
  }

  // "hot" alone is ambiguous: temperature if paired with drink/mug/winter words, otherwise chili heat.
  if (/ hot /.test(text)) {
    if (intent.style.hot || / (mug|winter|cold|warm) /.test(text) || intent.tags.warm) intent.style.hot = true;
    else { add(intent.tags, 'chili', 1.5); intent.matched.push({ phrase: 'hot', label: 'chili heat' }); }
  }
  if (intent.style.hot) intent.style.frozen = false;
  if (intent.style.zeroProof) intent.strength = -3;
  return intent;
}

function applyEffect(intent, e, sign, soft) {
  const add = (obj, k, v) => { obj[k] = (obj[k] || 0) + v; };
  if (e.tags) for (const [t, w] of Object.entries(e.tags)) {
    if (sign > 0) add(intent.tags, t, w);
    else if (soft) add(intent.tags, t, -w * 0.6);
    else add(intent.avoidTags, t, w);
  }
  if (e.ings) for (const [id, w] of Object.entries(e.ings)) {
    if (sign > 0) add(intent.ings, id, w);
    else if (!soft) intent.avoidIngs.add(id);
  }
  if (e.spirits) for (const s of e.spirits) {
    if (sign > 0) { if (!intent.spirits.includes(s)) intent.spirits.push(s); }
    else intent.avoidSpirits.add(s);
  }
  if (e.fam) for (const [f, w] of Object.entries(e.fam)) add(intent.fam, f, sign * w);
  // Negated "sweet" means drier; negated "strong" means lighter, and so on.
  for (const key of ['strength', 'sweetness', 'tartness', 'complexity']) if (e[key]) intent[key] += sign * e[key];
  if (e.style) for (const [s, v] of Object.entries(e.style)) {
    if (sign > 0) intent.style[s] = v;
    else if (s === 'creamy' || s === 'long' || s === 'bitter' || s === 'frozen' || s === 'hot' || s === 'flaming') intent.style[s] = false;
  }
  if (e.color && sign > 0) intent.color = e.color;
}
