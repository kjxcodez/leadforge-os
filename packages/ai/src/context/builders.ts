export const AIContextBuilders = {
  buildCompanyContext: (company: { name: string; industry: string }) => {
    return {
      companyName: company.name,
      industry: company.industry || 'Software'
    };
  },

  buildLeadIntelligenceContext: (company: {
    name: string;
    industry: string;
    techStack?: string[];
    technicalIssues?: string[];
  }) => {
    return {
      companyName: company.name,
      industry: company.industry || 'Software',
      techStack: company.techStack || [],
      technicalIssues: company.technicalIssues || []
    };
  }
};
