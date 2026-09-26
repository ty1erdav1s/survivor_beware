/**********************************************************************
 * SEASON DATA — the only file that changes from season to season.
 * ------------------------------------------------------------------
 * One file, two homes:
 *   - The site loads it (season.js) to preview on demo data.
 *   - Apps Script: paste it as a file named "Season" next to Code.gs,
 *     then run setup(). Re-running setup() after edits is safe — it
 *     updates profiles/questions and never touches picks, answers or
 *     recorded vote-outs.
 *
 * cast[].out    placement already known when the season is loaded
 *               (first boot of 21 = 21). Only used on first insert;
 *               after that the admin panel owns placements.
 * lockAfterBoots picks lock automatically once this many castaways are
 *               out (Survivor: 2 = after Episode 2; Big Brother: 1 =
 *               after the first eviction). 0 = never auto-lock.
 * skin          'survivor' or 'bb' — the look and wording index.html uses.
 * wikiTitle     Wikipedia page the admin "Check Wikipedia" button reads.
 * wikiOrder     'firstOutFirst' (Survivor tables) or 'firstOutLast' (Big
 *               Brother tables list the winner at the top).
 *
 * Profiles: CBS/Paramount+ cast reveal, Wikipedia contestants table,
 * and pre-season previews (Surviving Tribal, Inside Survivor), Sept 2026.
 *********************************************************************/

var SEASON = {
  seasonId: 's51',
  show: 'survivor',
  skin: 'survivor',
  title: 'Survivors Beware — Season 51',
  lockAfterBoots: 2,
  lockNote: 'after Episode 2',
  wikiTitle: 'Survivor 51',
  wikiOrder: 'firstOutFirst',

  theme: {
    name:'Torchlight', bg:'#0a130e', surface:'#13221a', line:'#2b4133',
    text:'#f4ead5', muted:'#9fb09a', accent:'#ff8a2b', gold:'#f2c14e',
    danger:'#e5484d', evicted:'#3a3a2c', good:'#6fd08c'
  },

  cast: [
    { id:1, name:'Aaliyah Puglia', age:24, home:'Providence, RI', occ:'Chef', tribe:'Toka', out:21,
      bio:'A creative chef with a big family cheering her on and a real love of Survivor strategy. Pegged as a social player with an under-the-radar competitive streak — the first person voted out of Season 51.' },
    { id:2, name:'Alexis Levine', age:34, home:'Atlanta, GA', occ:'Criminal Defense Attorney', tribe:'Savu',
      bio:'Calls herself outgoing, thoughtful and determined, and is playing for her daughter. Previews see a social butterfly with a caretaker\'s heart and a strategist\'s head.' },
    { id:3, name:'Ana Sani', age:34, home:'Toronto, ON', occ:'Voice Actress', tribe:'Savu',
      bio:'An actor and voiceover artist whose job is literally becoming other people. That could help her click with every personality on the beach — or leave people wondering who the real Ana is.' },
    { id:4, name:'Brady Booker', age:27, home:'Knoxville, TN', occ:'Pro Wrestler', tribe:'Toka',
      bio:'An AEW/ROH pro wrestler, massive superfan and friend of Survivor alum Jonathan Young. Big and physical, but says he wants alliances with every type of player. Helped flip the premiere vote onto Aaliyah.' },
    { id:5, name:'Carter Krull', age:24, home:'Sioux Falls, SD', occ:'Livestock Farmer', tribe:'Savu',
      bio:'The youngest man in the cast, with hard-working Midwestern charm. Values communication in an ally — the kind of guy people trust to follow through.' },
    { id:6, name:'Cristian Chavez', age:26, home:'Salt Lake City, UT', occ:'Head of HR', tribe:'Savu',
      bio:'A superfan with a loud, booming laugh and a streak of chaos-demon energy. His HR day job is all about reading people, which should come in handy around camp.' },
    { id:7, name:'Danny Kilby', age:30, home:'London, ON', occ:'Game Designer', tribe:'Toka',
      bio:'Goes by "Kilby." A reality-TV superfan who co-hosted an edgic podcast for years, played the YouTube game Sequester and runs mock Survivor games for fun. Now it\'s the real thing.' },
    { id:8, name:'Devin Way', age:33, home:'Los Angeles, CA', occ:'Actor', tribe:'Toka',
      bio:'A media-trained actor planning to hide his job from the tribe. Describes himself as a mix of Joe Hunter and Rick Devens, and says he doesn\'t want to lie or backstab his way through.' },
    { id:9, name:'Eric Macksoud', age:34, home:'Windsor Locks, CT', occ:'Mental Health Counselor', tribe:'Savu',
      bio:'A counselor and community-theatre hobbyist who builds connection for a living. Previews flag a sneaky villainous edge under the warmth.' },
    { id:10, name:'Jelly Loblack', age:29, home:'Bloomington, IN', occ:'Sociology Professor', tribe:'Toka',
      bio:'Angelica "Jelly" Loblack is not an outdoors person and never expected to be on Survivor. Infectious energy and physically competitive — a real social and strategic threat.' },
    { id:11, name:'Jenna Doore', age:30, home:'Toledo, OH', occ:'Wedding Photographer', tribe:'Toka',
      bio:'A lifelong fan who arrived bubbly and prepared, with big Hubicki/Cochran superfan energy. She was the original premiere target until the vote flipped to Aaliyah.' },
    { id:12, name:'Kristin Flickinger', age:49, home:'Santa Barbara, CA', occ:'Crisis Management', tribe:'Savu',
      bio:'The oldest castaway this season, and a superfan who first applied back in the Australian Outback days. Brings calm, crisis-tested strength.' },
    { id:13, name:'Lewis Kelly', age:28, home:'Corozal, PR', occ:'Farmer', tribe:'Toka',
      bio:'Born in Dublin — the first Dubliner in US Survivor history — and now farming in Puerto Rico, so heat and hard work are nothing new. Leans on Irish charm, banter and humor.' },
    { id:14, name:'Linnea Capobianco', age:25, home:'Jersey City, NJ', occ:'Entrepreneur', tribe:'Savu',
      bio:'A New Jersey business owner who lives unapologetically and leads with inclusivity. Previews place her somewhere between Debbie Wanner and Coach — expect big character energy.' },
    { id:15, name:'Maggie Nestor', age:40, home:'Charles Town, WV', occ:'Farmer', tribe:'Toka',
      bio:'The first contestant ever from West Virginia and one of three farmers this season. A hard-working ray of sunshine who says she\'ll play fearlessly.' },
    { id:16, name:'Mike Pinsky', age:32, home:'New York, NY', occ:'Baseball Executive', tribe:'Toka',
      bio:'Has watched since he was 8 and plays mock Survivor games with his family. His MLB job is all negotiation and strategy — a sporty Stephen Fishbach type.' },
    { id:17, name:'Ori Jean-Charles', age:27, home:'Spring Valley, NY', occ:'Personal Trainer', tribe:'Savu',
      bio:'A former NCAA Division I athlete and self-described hustler. Charm plus strength should carry him through the early challenges.' },
    { id:18, name:'Patt Cannaday', age:33, home:'Washington, DC', occ:'Federal Prosecutor', tribe:'Toka',
      bio:'Into hiking, skydiving and boxing, and looking for allies up for shenanigans. Tipped Jenna off in the premiere, which helped flip the first vote.' },
    { id:19, name:'Rob Antonson', age:40, home:'Cumberland, RI', occ:'Airline Gate Agent', tribe:'Savu',
      bio:'A Rhode Island gate agent working out of Boston, with a New England accent that already has people making Boston Rob comparisons.' },
    { id:20, name:'Sharonda Cox', age:34, home:'Richmond, KY', occ:'OBGYN Resident', tribe:'Savu',
      bio:'A Kentucky physician described as wholesome and kind-hearted, playing for self-discovery and to inspire others — but previews say she\'s willing to make big strategic cuts.' },
    { id:21, name:'Thien An Nguyen', age:24, home:'Fort Worth, TX', occ:'Medical Student', tribe:'Toka',
      bio:'A 5-foot-tall extrovert who loves to travel and once ran a marathon on a whim. Quirky and charming — a combination that could play well with a jury.' }
  ],

  questions: [
    { qId:'q1', text:'Will a hidden immunity idol be found before the merge?' },
    { qId:'q2', text:'Will an idol be played and actually cancel votes?' },
    { qId:'q3', text:'Will someone be medically evacuated?' },
    { qId:'q4', text:'Will anyone quit the game?' },
    { qId:'q5', text:'Will a tie go all the way to a rock draw?' },
    { qId:'q6', text:'Will someone be blindsided with an idol in their pocket?' },
    { qId:'q7', text:'Will the winner have won fire-making at Final 4?' },
    { qId:'q8', text:'Will the winner get a unanimous jury vote?' },
    { qId:'q9', text:'Will someone cry at Tribal Council?' }
  ],

  // Seeds the player list the first time setup() runs for this season; after that, use Admin → Players.
  roster: ['Tyler','Lauren','Lisa','Jeremy','Natalie/Josh','Brandie','Morgan',
           'Thomas','Carol','Pat','Jamie','Kelly','AI']
};
