// Character creation and durable professional capabilities for the first expedition.
// The first hundred are already exceptional; campaign progression should grow influence,
// relationships and practical familiarity rather than rapidly raising core professional ability.

export const IDEOLOGIES = [
  {id:'transformation',name:'Transformation',tradition:'Sax',description:'Make Mars habitable through science, engineering and deliberate planetary change.',priorities:['Terraforming','Scientific progress','Planetary infrastructure'],victory:'Establish a durable, broadly supported programme of planetary transformation.'},
  {id:'preservation',name:'Preservation',tradition:'Ann',description:'Recognise Mars as a world with intrinsic value, not merely a resource or human project.',priorities:['Environmental protection','Scientific observation','Protected regions'],victory:'Secure lasting protections for significant Martian environments.'},
  {id:'communitarian',name:'Ecological communitarianism',tradition:'Hiroko',description:'Build a new society based on ecological responsibility, shared life and self-sufficiency.',priorities:['Ecological living','Collective institutions','Local resilience'],victory:'Establish durable, self-sufficient communities with legitimate collective institutions.'},
  {id:'sovereignty',name:'Martian sovereignty',tradition:'Arkady / John',description:'Ensure Mars determines its own political future, through revolutionary or democratic routes.',priorities:['Self-government','Martian institutions','Political independence'],victory:'Achieve meaningful Martian self-government with durable legitimacy.'},
  {id:'pragmatism',name:'Institutional pragmatism',tradition:'Frank',description:'Build workable institutions, maintain order and secure progress through compromise.',priorities:['Stable institutions','Treaties','Administration'],victory:'Establish stable, legitimate institutions capable of sustaining cooperation.'},
  {id:'commercial',name:'Commercial development',tradition:'Phyllis',description:'Use private enterprise, investment and trade to develop a prosperous Martian economy.',priorities:['Investment','Resource development','Commercial rights'],victory:'Establish a prosperous Martian economy with secure, durable commercial institutions.'}
];

export const PLAYER_BACKGROUNDS = [
  {id:'scientist',name:'Scientist',description:'A distinguished research career and a strong scientific network.',expertise:{science:5,chemistry:4,biology:3,geology:3,atmosphericScience:3},attributes:{diplomacy:2,leadership:2,communication:3,administration:2,engineering:2}},
  {id:'engineer',name:'Engineer',description:'A record of delivering complex infrastructure and industrial systems.',expertise:{engineering:5,robotics:3,programming:3,materialsScience:4},attributes:{diplomacy:2,leadership:3,communication:2,administration:3,science:3}},
  {id:'pilot',name:'Pilot',description:'Extensive operational experience with demanding vehicles and transport systems.',expertise:{piloting:5,engineering:2,robotics:2},vehicleCompetence:{aircraft:5,spacecraft:4,zeppelin:3,rover:2},attributes:{diplomacy:2,leadership:3,communication:3,administration:2,science:2}},
  {id:'diplomat',name:'Diplomat',description:'A career in international negotiation, institutions and complex agreements.',expertise:{},attributes:{diplomacy:5,leadership:4,communication:4,administration:4,engineering:1,science:2}},
  {id:'organiser',name:'Political organiser',description:'A proven ability to build coalitions, movements and public campaigns.',expertise:{},attributes:{diplomacy:4,leadership:5,communication:5,administration:3,engineering:1,science:2}},
  {id:'technologist',name:'Robotics and cyber specialist',description:'Deep experience in software, autonomous systems and network security.',expertise:{programming:5,robotics:5,cyberOperations:4,engineering:3},attributes:{diplomacy:2,leadership:2,communication:2,administration:2,science:3}},
  {id:'physician',name:'Physician',description:'A senior medical career in clinical practice, public health or expedition medicine.',expertise:{medicine:5,biology:4,chemistry:2},attributes:{diplomacy:3,leadership:3,communication:3,administration:3,science:3}}
];

export const SECONDARY_EXPERTISE = [
  {id:'atmosphericScience',name:'Atmospheric science'},
  {id:'biology',name:'Biology'},
  {id:'chemistry',name:'Chemistry'},
  {id:'cyberOperations',name:'Cyber operations'},
  {id:'engineering',name:'Engineering'},
  {id:'geology',name:'Geology'},
  {id:'medicine',name:'Medicine'},
  {id:'materialsScience',name:'Materials science'},
  {id:'piloting',name:'Piloting'},
  {id:'programming',name:'Programming'},
  {id:'robotics',name:'Robotics'},
  {id:'science',name:'Scientific research'}
];

export function createPlayerCharacter({majorIdeology='sovereignty',minorIdeology='communitarian',background='scientist',secondaryExpertise=null}={}) {
  const major=IDEOLOGIES.find(x=>x.id===majorIdeology);
  const minor=IDEOLOGIES.find(x=>x.id===minorIdeology);
  const origin=PLAYER_BACKGROUNDS.find(x=>x.id===background);
  if(!major||!minor||major.id===minor.id||!origin) throw new Error('Choose two different ideologies and a valid professional background.');
  const attributes={diplomacy:1,leadership:1,communication:1,administration:1,engineering:1,science:1,...origin.attributes};
  const expertise={science:0,programming:0,robotics:0,cyberOperations:0,chemistry:0,biology:0,geology:0,medicine:0,materialsScience:0,atmosphericScience:0,piloting:0,...origin.expertise};
  if(secondaryExpertise && Object.hasOwn(expertise,secondaryExpertise)) expertise[secondaryExpertise]=Math.max(3,expertise[secondaryExpertise]);
  // Routine rover operation is ordinary competence, not a professional pilot qualification.
  expertise.roverOperation=0;
  return {
    name:'Expedition Member',
    cohort:'First Hundred',
    majorIdeology:major.id,
    minorIdeology:minor.id,
    background:origin.id,
    backgroundName:origin.name,
    attributes,
    expertise,
    vehicleCompetence:{rover:0,aircraft:0,zeppelin:0,spacecraft:0,...origin.vehicleCompetence},
    qualifications:[origin.name,...(secondaryExpertise?[SECONDARY_EXPERTISE.find(x=>x.id===secondaryExpertise)?.name].filter(Boolean):[])],
    reputation:0,
    politicalInfluence:10,
    practicalExperience:{},
    organisationId:null,
    createdSol:0
  };
}
