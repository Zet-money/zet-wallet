"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export interface Wallet {
  address: string;
  mnemonic: string;
  isImported: boolean;
}

interface WalletContextType {
  wallet: Wallet | null;
  isWalletInitialized: boolean;
  isLoading: boolean;
  createWallet: () => void;
  importWallet: (mnemonic: string) => void;
  confirmMnemonicSaved: () => void;
  clearWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isWalletInitialized, setIsWalletInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Session management functions
  const saveSession = (walletData: Wallet) => {
    const sessionData = {
      wallet: walletData,
      timestamp: Date.now(),
      sessionId: `zet_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    localStorage.setItem('zet_wallet_session', JSON.stringify(sessionData));
  };

  const loadSession = (): { wallet: Wallet; sessionId: string } | null => {
    try {
      const sessionData = localStorage.getItem('zet_wallet_session');
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        // Check if session is not older than 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        if (parsed.timestamp > thirtyDaysAgo) {
          return { wallet: parsed.wallet, sessionId: parsed.sessionId };
        } else {
          // Session expired, clear it
          localStorage.removeItem('zet_wallet_session');
        }
      }
    } catch (error) {
      console.error('Error loading session:', error);
      localStorage.removeItem('zet_wallet_session');
    }
    return null;
  };

  const clearSession = () => {
    localStorage.removeItem('zet_wallet_session');
  };

  // Initialize wallet from session on mount
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setWallet(session.wallet);
      setIsWalletInitialized(true);
    }
    setIsLoading(false);
  }, []);

  // Generate a 12-word mnemonic phrase
  const generateMnemonic = (): string => {
    const words = [
      'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
      'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
      'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
      'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
      'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert',
      'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter',
      'always', 'amateur', 'amazing', 'among', 'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger',
      'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
      'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic',
      'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest',
      'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset',
      'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
      'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake',
      'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon', 'badge',
      'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain',
      'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
      'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit',
      'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind', 'biology',
      'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless',
      'blind', 'blood', 'blossom', 'blow', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
      'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss',
      'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave', 'bread',
      'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze',
      'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
      'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy',
      'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call',
      'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas',
      'canyon', 'capable', 'capital', 'captain', 'car', 'carbon', 'card', 'care', 'career', 'careful',
      'careless', 'cargo', 'carpet', 'carry', 'cart', 'case', 'cash', 'casino', 'cast', 'casual',
      'cat', 'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave', 'ceiling',
      'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk', 'champion', 'change',
      'chaos', 'charge', 'chase', 'cheap', 'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken',
      'chief', 'child', 'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn', 'cigar',
      'cinnamon', 'circle', 'citizen', 'city', 'civil', 'claim', 'clamp', 'clarify', 'claw', 'clay',
      'clean', 'clerk', 'clever', 'click', 'client', 'cliff', 'climb', 'cling', 'clinic', 'clip',
      'clock', 'clog', 'close', 'cloth', 'cloud', 'clown', 'club', 'clump', 'cluster', 'clutch',
      'coach', 'coast', 'coconut', 'code', 'coffee', 'coil', 'coin', 'collect', 'color', 'column',
      'come', 'comfort', 'comic', 'common', 'company', 'concert', 'conduct', 'confirm', 'congress', 'connect',
      'consider', 'control', 'convince', 'cook', 'cool', 'copper', 'copy', 'coral', 'core', 'corn',
      'correct', 'cost', 'cotton', 'couch', 'country', 'couple', 'course', 'cousin', 'cover', 'coyote',
      'crack', 'cradle', 'craft', 'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy', 'cream',
      'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic', 'crop', 'cross', 'crouch',
      'crowd', 'crucial', 'cruel', 'cruise', 'crumble', 'crunch', 'crush', 'cry', 'crystal', 'cube',
      'culture', 'cup', 'cupboard', 'curious', 'current', 'curtain', 'curve', 'cushion', 'custom', 'cute',
      'cycle', 'dad', 'damage', 'damp', 'dance', 'danger', 'daring', 'dash', 'daughter', 'dawn',
      'day', 'deal', 'debate', 'debris', 'decade', 'december', 'decide', 'decline', 'decorate', 'decrease',
      'deer', 'defense', 'define', 'defy', 'degree', 'delay', 'deliver', 'demand', 'demise', 'denial',
      'dentist', 'deny', 'depart', 'depend', 'deposit', 'depth', 'deputy', 'derive', 'describe', 'desert',
      'design', 'desk', 'despair', 'destroy', 'detail', 'detect', 'develop', 'device', 'devote', 'diagram',
      'dial', 'diamond', 'diary', 'dice', 'diesel', 'diet', 'differ', 'digital', 'dignity', 'dilemma',
      'dinner', 'dinosaur', 'direct', 'dirt', 'disagree', 'discover', 'disease', 'dish', 'dismiss', 'disorder',
      'display', 'distance', 'divert', 'divide', 'divorce', 'dizzy', 'doctor', 'document', 'dog', 'doll',
      'dolphin', 'domain', 'donate', 'donkey', 'donor', 'door', 'dose', 'double', 'dove', 'draft',
      'dragon', 'drama', 'drastic', 'draw', 'dream', 'dress', 'drift', 'drill', 'drink', 'drip',
      'drive', 'drop', 'drum', 'dry', 'duck', 'dumb', 'dune', 'during', 'dusk', 'dust',
      'dutch', 'duty', 'dwarf', 'dynamic', 'eager', 'eagle', 'early', 'earn', 'earth', 'easily',
      'east', 'easy', 'echo', 'ecology', 'economy', 'edge', 'edit', 'educate', 'effort', 'egg',
      'eight', 'either', 'elbow', 'elder', 'electric', 'elegant', 'element', 'elephant', 'elevator', 'elite',
      'else', 'embark', 'embody', 'embrace', 'emerge', 'emotion', 'employ', 'empower', 'empty', 'enable',
      'enact', 'end', 'endless', 'endorse', 'enemy', 'energy', 'enforce', 'engage', 'engine', 'english',
      'enjoy', 'enlist', 'enough', 'enrich', 'enroll', 'ensure', 'enter', 'entire', 'entry', 'envelope',
      'episode', 'equal', 'equip', 'era', 'erase', 'erode', 'erosion', 'erupt', 'escape', 'essay',
      'essence', 'estate', 'eternal', 'ethics', 'evidence', 'evil', 'evoke', 'evolve', 'exact', 'example',
      'excess', 'exchange', 'excite', 'exclude', 'excuse', 'execute', 'exercise', 'exhaust', 'exhibit', 'exile',
      'exist', 'exit', 'exotic', 'expand', 'expect', 'expire', 'explain', 'expose', 'express', 'extend',
      'extra', 'eye', 'eyebrow', 'fabric', 'face', 'faculty', 'fade', 'faint', 'faith', 'fall',
      'false', 'fame', 'family', 'famous', 'fan', 'fancy', 'fantasy', 'farm', 'fashion', 'fat',
      'fatal', 'father', 'fatigue', 'fault', 'favorite', 'feature', 'february', 'federal', 'fee', 'feed',
      'feel', 'female', 'fence', 'festival', 'fetch', 'fever', 'few', 'fiber', 'fiction', 'field',
      'figure', 'file', 'film', 'filter', 'final', 'find', 'fine', 'finger', 'finish', 'fire',
      'firm', 'first', 'fiscal', 'fish', 'fitness', 'fix', 'flag', 'flame', 'flash', 'flat',
      'flavor', 'flee', 'flight', 'flip', 'float', 'flock', 'floor', 'flower', 'fluid', 'flush',
      'fly', 'foam', 'focus', 'fog', 'foil', 'fold', 'follow', 'food', 'foot', 'force',
      'forest', 'forget', 'fork', 'fortune', 'forum', 'forward', 'fossil', 'foster', 'found', 'fox',
      'fragile', 'frame', 'frequent', 'fresh', 'friend', 'fringe', 'frog', 'front', 'frost', 'frown',
      'frozen', 'fruit', 'fuel', 'fun', 'funny', 'furnace', 'fury', 'future', 'gadget', 'gain',
      'galaxy', 'gallery', 'game', 'gap', 'garage', 'garbage', 'garden', 'garlic', 'garment', 'gas',
      'gasp', 'gate', 'gather', 'gauge', 'gaze', 'general', 'genius', 'genre', 'gentle', 'genuine',
      'gesture', 'ghost', 'giant', 'gift', 'giggle', 'ginger', 'giraffe', 'girl', 'give', 'glad',
      'glance', 'glare', 'glass', 'glide', 'glimpse', 'globe', 'gloom', 'glory', 'glove', 'glow',
      'glue', 'goat', 'goddess', 'gold', 'good', 'goose', 'gorilla', 'gospel', 'gossip', 'govern',
      'gown', 'grab', 'grace', 'grain', 'grant', 'grape', 'grass', 'gravity', 'great', 'green',
      'grid', 'grief', 'grit', 'grocery', 'group', 'grow', 'grunt', 'guard', 'guess', 'guide',
      'guilt', 'guitar', 'gun', 'gym', 'habit', 'hair', 'half', 'hammer', 'hamster', 'hand',
      'happy', 'harbor', 'hard', 'harsh', 'harvest', 'hash', 'hassle', 'hat', 'have', 'hawk',
      'hazard', 'head', 'health', 'heart', 'heavy', 'hedgehog', 'height', 'hello', 'helmet', 'help',
      'hen', 'hero', 'hidden', 'high', 'hill', 'hint', 'hip', 'hire', 'history', 'hobby',
      'hockey', 'hold', 'hole', 'holiday', 'hollow', 'home', 'honey', 'hood', 'hope', 'horn',
      'horror', 'horse', 'hospital', 'host', 'hotel', 'hour', 'hover', 'hub', 'huge', 'human',
      'humble', 'humor', 'hundred', 'hungry', 'hunt', 'hurdle', 'hurry', 'hurt', 'husband', 'hybrid',
      'ice', 'icon', 'idea', 'identify', 'idle', 'ignore', 'ill', 'illegal', 'illness', 'image',
      'imitate', 'immense', 'immune', 'impact', 'impose', 'improve', 'impulse', 'inch', 'include', 'income',
      'increase', 'index', 'indicate', 'indoor', 'industry', 'infant', 'inflict', 'inform', 'inhale', 'inherit',
      'initial', 'inject', 'injury', 'inmate', 'inner', 'innocent', 'input', 'inquiry', 'insane', 'insect',
      'inside', 'inspire', 'install', 'intact', 'interest', 'into', 'invest', 'invite', 'involve', 'iron',
      'island', 'isolate', 'issue', 'item', 'ivory', 'jacket', 'jaguar', 'jar', 'jazz', 'jealous',
      'jeans', 'jelly', 'jewel', 'job', 'join', 'joke', 'journey', 'joy', 'judge', 'juice',
      'jump', 'jungle', 'junior', 'junk', 'just', 'kangaroo', 'keen', 'keep', 'ketchup', 'key',
      'kick', 'kid', 'kidney', 'kind', 'kingdom', 'kiss', 'kit', 'kitchen', 'kite', 'kitten',
      'kiwi', 'knee', 'knife', 'knock', 'know', 'lab', 'label', 'labor', 'ladder', 'lady',
      'lake', 'lamp', 'land', 'large', 'last', 'late', 'latin', 'laugh', 'laundry', 'lava',
      'law', 'lawn', 'lawsuit', 'layer', 'lazy', 'leader', 'leaf', 'learn', 'leave', 'lecture',
      'left', 'leg', 'legal', 'legend', 'leisure', 'lemon', 'lend', 'length', 'lens', 'leopard',
      'lesson', 'letter', 'level', 'liar', 'liberty', 'library', 'license', 'life', 'lift', 'light',
      'like', 'limb', 'limit', 'link', 'lion', 'liquid', 'list', 'little', 'live', 'lizard',
      'load', 'loan', 'lobster', 'local', 'lock', 'logic', 'lonely', 'long', 'loop', 'lottery',
      'loud', 'lounge', 'love', 'loyal', 'lucky', 'luggage', 'lumber', 'lunar', 'lunch', 'luxury',
      'lyrics', 'machine', 'mad', 'magic', 'magnet', 'maid', 'mail', 'main', 'major', 'make',
      'mammal', 'man', 'manage', 'mandate', 'mango', 'mansion', 'manual', 'maple', 'marble', 'march',
      'margin', 'marine', 'market', 'marriage', 'mask', 'mass', 'master', 'match', 'material', 'math',
      'matrix', 'matter', 'maximum', 'maze', 'meadow', 'mean', 'measure', 'meat', 'mechanic', 'medal',
      'media', 'melody', 'melt', 'member', 'memory', 'mention', 'menu', 'mercy', 'merge', 'merit',
      'merry', 'mesh', 'message', 'metal', 'method', 'middle', 'midnight', 'milk', 'million', 'mimic',
      'mind', 'minimum', 'minor', 'minute', 'miracle', 'mirror', 'misery', 'miss', 'mistake', 'mix',
      'mixed', 'mixture', 'mobile', 'model', 'modify', 'mom', 'moment', 'monitor', 'monkey', 'monster',
      'month', 'moon', 'moral', 'more', 'morning', 'mosquito', 'mother', 'motion', 'motor', 'mountain',
      'mouse', 'move', 'movie', 'much', 'muffin', 'mule', 'multiply', 'muscle', 'museum', 'mushroom',
      'music', 'must', 'mutual', 'myself', 'mystery', 'naive', 'name', 'napkin', 'narrow', 'nasty',
      'nation', 'nature', 'near', 'neck', 'need', 'negative', 'neglect', 'neither', 'nephew', 'nerve',
      'nest', 'net', 'network', 'neutral', 'never', 'news', 'next', 'nice', 'night', 'noble',
      'noise', 'nominee', 'noodle', 'normal', 'north', 'nose', 'notable', 'note', 'nothing', 'notice',
      'novel', 'now', 'nuclear', 'number', 'nurse', 'nut', 'oak', 'obey', 'object', 'oblige',
      'obscure', 'observe', 'obtain', 'obvious', 'occur', 'ocean', 'october', 'odor', 'off', 'offer',
      'office', 'often', 'oil', 'okay', 'old', 'olive', 'olympic', 'omit', 'once', 'one',
      'onion', 'online', 'only', 'open', 'opera', 'opinion', 'oppose', 'option', 'orange', 'orbit',
      'orchard', 'order', 'ordinary', 'organ', 'orient', 'original', 'orphan', 'ostrich', 'other', 'out',
      'outdoor', 'outer', 'outline', 'outlook', 'output', 'outrage', 'outset', 'outside', 'oval', 'oven',
      'over', 'own', 'owner', 'oxygen', 'oyster', 'ozone', 'pact', 'paddle', 'page', 'pair',
      'palace', 'palm', 'panda', 'panel', 'panic', 'panther', 'paper', 'parade', 'parent', 'park',
      'parrot', 'party', 'pass', 'patch', 'path', 'patient', 'patrol', 'pattern', 'pause', 'pave',
      'paw', 'pay', 'peace', 'peanut', 'pear', 'peasant', 'pelican', 'pen', 'penalty', 'pencil',
      'people', 'pepper', 'perfect', 'permit', 'person', 'pet', 'phone', 'photo', 'phrase', 'physical',
      'piano', 'picnic', 'picture', 'piece', 'pig', 'pigeon', 'pill', 'pilot', 'pink', 'pioneer',
      'pipe', 'pistol', 'pitch', 'pizza', 'place', 'plague', 'planet', 'plastic', 'plate', 'play',
      'please', 'pledge', 'pluck', 'plug', 'plunge', 'poem', 'poet', 'point', 'polar', 'pole',
      'police', 'pond', 'pony', 'pool', 'poor', 'pop', 'popcorn', 'popular', 'porch', 'port',
      'portion', 'portrait', 'pose', 'position', 'positive', 'possible', 'post', 'potato', 'pottery', 'poverty',
      'powder', 'power', 'practice', 'praise', 'predict', 'prefer', 'prepare', 'present', 'pretty', 'prevent',
      'price', 'pride', 'primary', 'print', 'priority', 'prison', 'private', 'prize', 'problem', 'process',
      'produce', 'profit', 'program', 'project', 'promote', 'proof', 'property', 'prosper', 'protect', 'proud',
      'provide', 'public', 'pudding', 'pull', 'pulp', 'pulse', 'pumpkin', 'punch', 'pupil', 'puppy',
      'push', 'put', 'puzzle', 'pyramid', 'quality', 'quantum', 'quarter', 'question', 'quick', 'quit',
      'quiz', 'quote', 'rabbit', 'raccoon', 'race', 'rack', 'radar', 'radio', 'rail', 'rain',
      'raise', 'rally', 'ramp', 'ranch', 'random', 'range', 'rapid', 'rare', 'rate', 'rather',
      'raven', 'raw', 'razor', 'ready', 'real', 'reason', 'rebel', 'rebuild', 'recall', 'receive',
      'recipe', 'record', 'recover', 'recycle', 'red', 'reduce', 'reflect', 'reform', 'refuse', 'region',
      'regret', 'regular', 'reject', 'relax', 'release', 'relief', 'rely', 'remain', 'remember', 'remind',
      'remove', 'render', 'renew', 'rent', 'reopen', 'repair', 'repeat', 'replace', 'reply', 'report',
      'require', 'rescue', 'resemble', 'resist', 'resource', 'response', 'result', 'retire', 'retreat', 'return',
      'reveal', 'review', 'reward', 'rhythm', 'rib', 'ribbon', 'rice', 'rich', 'ride', 'ridge',
      'rifle', 'right', 'rigid', 'ring', 'riot', 'ripple', 'risk', 'ritual', 'rival', 'river',
      'road', 'roast', 'robot', 'robust', 'rocket', 'romance', 'roof', 'rookie', 'room', 'rose',
      'rotate', 'rough', 'round', 'route', 'row', 'royal', 'rubber', 'rude', 'rug', 'rule',
      'run', 'runway', 'rural', 'sad', 'saddle', 'sadness', 'safe', 'sail', 'salad', 'salmon',
      'salon', 'salt', 'salute', 'same', 'sample', 'sand', 'satisfy', 'satoshi', 'sauce', 'sausage',
      'save', 'say', 'scale', 'scan', 'scare', 'scatter', 'scene', 'scheme', 'school', 'science',
      'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea', 'search', 'season',
      'seat', 'second', 'secret', 'section', 'security', 'seed', 'seek', 'segment', 'select', 'sell',
      'seminar', 'senior', 'sense', 'sentence', 'series', 'service', 'session', 'settle', 'setup', 'seven',
      'shadow', 'shaft', 'shallow', 'share', 'shed', 'shell', 'sheriff', 'shield', 'shift', 'shine',
      'ship', 'shiver', 'shock', 'shoe', 'shoot', 'shop', 'shore', 'short', 'shoulder', 'shove',
      'shrimp', 'shrug', 'shuffle', 'shy', 'sibling', 'sick', 'side', 'siege', 'sight', 'sign',
      'silent', 'silk', 'silly', 'silver', 'similar', 'simple', 'since', 'sing', 'siren', 'sister',
      'situate', 'six', 'size', 'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt', 'skull',
      'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt', 'skull', 'slab', 'slam', 'sleep',
      'slender', 'slice', 'slide', 'slight', 'slim', 'slogan', 'slot', 'slow', 'sluice', 'slum',
      'slurp', 'slush', 'sly', 'smack', 'small', 'smile', 'smoke', 'smooth', 'smuggle', 'snack',
      'snake', 'snap', 'snare', 'snarl', 'sneak', 'sneeze', 'sniff', 'snore', 'snort', 'snout',
      'snow', 'snub', 'snuff', 'snug', 'soak', 'soap', 'soar', 'sob', 'soccer', 'social',
      'sock', 'soda', 'sofa', 'soft', 'soggy', 'soil', 'solar', 'soldier', 'solid', 'solo',
      'solution', 'solve', 'someone', 'song', 'soon', 'sore', 'sorry', 'sort', 'soul', 'sound',
      'soup', 'sour', 'south', 'space', 'spare', 'spark', 'sparse', 'spatial', 'spawn', 'speak',
      'speed', 'spell', 'spend', 'sphere', 'spice', 'spider', 'spike', 'spin', 'spirit', 'split',
      'spoil', 'sponsor', 'spoon', 'sport', 'spot', 'spray', 'spread', 'spring', 'spy', 'square',
      'squeeze', 'squirrel', 'stable', 'stadium', 'staff', 'stage', 'stairs', 'stamp', 'stand', 'start',
      'state', 'stay', 'steak', 'steal', 'steam', 'steel', 'steep', 'stem', 'step', 'stereo',
      'stick', 'still', 'sting', 'stink', 'stir', 'stock', 'stomach', 'stone', 'stool', 'stop',
      'store', 'storm', 'story', 'stove', 'straddle', 'straight', 'strand', 'strange', 'strategy', 'straw',
      'stream', 'street', 'stress', 'stretch', 'strict', 'stride', 'strike', 'string', 'strive', 'stroke',
      'stroll', 'strong', 'struggle', 'strum', 'strut', 'stuck', 'study', 'stuff', 'stumble', 'stun',
      'stunt', 'style', 'subject', 'submit', 'subway', 'succeed', 'such', 'sudden', 'suffer', 'sugar',
      'suggest', 'suit', 'sulk', 'sultry', 'summer', 'sun', 'sunny', 'sunset', 'super', 'supply',
      'supreme', 'sure', 'surface', 'surge', 'surprise', 'surround', 'survey', 'survive', 'suspect', 'suspend',
      'sustain', 'swallow', 'swamp', 'swap', 'swarm', 'sway', 'swear', 'sweat', 'sweep', 'sweet',
      'swell', 'swim', 'swing', 'switch', 'sword', 'swore', 'swum', 'swung', 'syllable', 'symbol',
      'symptom', 'syrup', 'system', 'table', 'tackle', 'tag', 'tail', 'talent', 'talk', 'tank',
      'tap', 'tape', 'target', 'task', 'taste', 'tattoo', 'taught', 'tax', 'tea', 'teach',
      'team', 'tear', 'tease', 'teen', 'teeth', 'telephone', 'tell', 'ten', 'tenant', 'tennis',
      'tent', 'term', 'test', 'text', 'thank', 'that', 'the', 'their', 'them', 'then',
      'there', 'these', 'they', 'thick', 'thin', 'thing', 'think', 'third', 'this', 'thorough',
      'those', 'though', 'thought', 'thousand', 'thrash', 'thread', 'threat', 'three', 'thrift', 'thrill',
      'thrive', 'throat', 'throne', 'through', 'throw', 'thrust', 'thumb', 'thump', 'thunder', 'thus',
      'tick', 'ticket', 'tide', 'tidy', 'tie', 'tiger', 'tight', 'tile', 'till', 'tilt',
      'timber', 'time', 'timid', 'tin', 'tiny', 'tip', 'tired', 'tissue', 'title', 'toad',
      'toast', 'today', 'toe', 'together', 'toilet', 'token', 'tomato', 'tomorrow', 'tone', 'tongue',
      'tonight', 'too', 'tool', 'tooth', 'top', 'topic', 'topple', 'torch', 'tornado', 'tortoise',
      'toss', 'total', 'touch', 'tough', 'tour', 'toward', 'tower', 'town', 'toy', 'track',
      'trade', 'traffic', 'tragic', 'train', 'transfer', 'trap', 'trash', 'travel', 'tray', 'treat',
      'tree', 'trend', 'trial', 'tribe', 'trick', 'trigger', 'trim', 'trip', 'trophy', 'trouble',
      'truck', 'true', 'truly', 'trumpet', 'trust', 'truth', 'try', 'tube', 'tuck', 'tuesday',
      'tug', 'tuition', 'tumble', 'tuna', 'tunnel', 'turbo', 'turtle', 'twelve', 'twenty', 'twice',
      'twin', 'twist', 'two', 'type', 'typical', 'ugly', 'umbrella', 'unable', 'unaware', 'uncle',
      'uncover', 'under', 'undo', 'unfair', 'unfold', 'unhappy', 'unique', 'unit', 'universe', 'unknown',
      'unlock', 'unlucky', 'unmask', 'unnoticed', 'unpack', 'unpaid', 'unpleasant', 'unrest', 'unsafe', 'until',
      'unusual', 'unveil', 'unwanted', 'unwelcome', 'unwell', 'unwieldy', 'unwise', 'unzip', 'up', 'update',
      'upgrade', 'uphold', 'upon', 'upper', 'upright', 'uproar', 'upset', 'urban', 'urge', 'usage',
      'use', 'used', 'useful', 'useless', 'user', 'usual', 'utility', 'vacant', 'vacuum', 'vague',
      'vain', 'valid', 'valley', 'valve', 'van', 'vanish', 'vapor', 'various', 'vast', 'vault',
      'vehicle', 'velvet', 'vendor', 'venom', 'vent', 'venture', 'venue', 'verb', 'verify', 'version',
      'very', 'vessel', 'veteran', 'viable', 'vibrant', 'vicious', 'victory', 'video', 'view', 'village',
      'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual', 'vital', 'vivid', 'vocal',
      'voice', 'void', 'volcano', 'volume', 'vote', 'voyage', 'wage', 'wagon', 'wait', 'wake',
      'walk', 'wall', 'walnut', 'want', 'war', 'warm', 'warn', 'wash', 'wasp', 'waste',
      'water', 'wave', 'way', 'we', 'weak', 'wealth', 'weapon', 'wear', 'weasel', 'weather',
      'web', 'wedding', 'weed', 'week', 'weird', 'welcome', 'west', 'wet', 'whale', 'what',
      'wheat', 'wheel', 'when', 'where', 'whip', 'whisper', 'white', 'who', 'whole', 'whom',
      'whose', 'why', 'wicked', 'wide', 'width', 'wife', 'wild', 'will', 'win', 'wind',
      'window', 'wine', 'wing', 'wink', 'winner', 'winter', 'wire', 'wisdom', 'wise', 'wish',
      'witness', 'wolf', 'woman', 'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry',
      'worse', 'worst', 'worth', 'would', 'wound', 'wrap', 'wreck', 'wrestle', 'wrist', 'write',
      'wrong', 'wrote', 'wrung', 'wry', 'xenon', 'xerox', 'xylophone', 'yacht', 'yard', 'yarn',
      'yawn', 'year', 'yellow', 'yes', 'yesterday', 'yet', 'yield', 'yogurt', 'yoke', 'you',
      'young', 'your', 'youth', 'zebra', 'zero', 'zinc', 'zone', 'zoo'
    ];
    
    const mnemonic = [];
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      mnemonic.push(words[randomIndex]);
    }
    return mnemonic.join(' ');
  };

  // Generate a mock wallet address
  const generateAddress = (): string => {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    return address;
  };

  const createWallet = () => {
    const mnemonic = generateMnemonic();
    const address = generateAddress();
    const newWallet: Wallet = {
      address,
      mnemonic,
      isImported: false,
    };
    setWallet(newWallet);
    // Don't set isWalletInitialized to true yet - wait for user to confirm they saved the mnemonic
  };

  const importWallet = (mnemonic: string) => {
    const address = generateAddress();
    const newWallet: Wallet = {
      address,
      mnemonic,
      isImported: true,
    };
    setWallet(newWallet);
    saveSession(newWallet);
    setIsWalletInitialized(true);
  };

  const confirmMnemonicSaved = () => {
    if (wallet) {
      saveSession(wallet);
    }
    setIsWalletInitialized(true);
  };

  const clearWallet = () => {
    setWallet(null);
    setIsWalletInitialized(false);
    clearSession();
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isWalletInitialized,
        isLoading,
        createWallet,
        importWallet,
        confirmMnemonicSaved,
        clearWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
