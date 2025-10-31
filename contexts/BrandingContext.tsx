import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface BrandingContextType {
  logoUrl: string | null;
  loading: boolean;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/api/branding');
        if (response.ok) {
          const data = await response.json();
          if (data.logo) {
            setLogoUrl(data.logo);
          }
        }
      } catch (error) {
        console.error("Failed to fetch custom logo", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, []);

  return (
    <BrandingContext.Provider value={{ logoUrl, loading }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};
