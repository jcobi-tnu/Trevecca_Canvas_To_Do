import ENGLISH_TRANSLATION from '../i18n/en.json';

export const getMessages = async (userLocale) => {
    const { messages: baseMessages } = ENGLISH_TRANSLATION;

    try {
        // Attempt territory-specific locale
        const localeModule = await import(`../i18n/${userLocale}.json`);
        const { messages: localeMessages } = localeModule;
        if (localeMessages) {
            return { ...baseMessages, ...localeMessages };
        } else {
            // Fallback to language-only
            const actionLanguage = userLocale.split(/[-_]/)[0];
            const langModule = await import(`../i18n/${actionLanguage}.json`);
            return { ...baseMessages, ...langModule.messages };
        }
    } catch (e) {
        try {
            const actionLanguage = userLocale.split(/[-_]/)[0];
            const langModule = await import(`../i18n/${actionLanguage}.json`);
            return { ...baseMessages, ...langModule.messages };
        } catch (e) {
            // UserLocale not supported
            return null;
        }
    }
};
