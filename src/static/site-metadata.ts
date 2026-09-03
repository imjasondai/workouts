interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  keywords: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const getBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL;
  return baseUrl === '/' ? '' : baseUrl;
};

const data: ISiteMetadataResult = {
  siteTitle: "Jason's Workout Dashboard",
  siteUrl: 'https://imjasondai.github.io/workouts/',
  logo: 'https://github.com/imjasondai.png',
  description: "Jason Dai's personal workout dashboard",
  keywords: 'workouts, running, cycling, hiking, swimming, strength training',
  navLinks: [
    {
      name: 'Strava',
      url: 'https://www.strava.com/athletes/ssaffybz',
    },
    {
      name: 'Summary',
      url: `${getBasePath()}/summary`,
    },
    {
      name: 'Blog',
      url: 'https://github.com/imjasondai',
    },
  ],
};

export default data;
