/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Typography, Link, Box, Toolbar, AppBar, List, ListItem } from '@mui/material';

import { Link as ReactRouterLink } from 'react-router';

import theme, { FOOTER_HEIGHT } from '../theme/theme';

const PrivacyPolicy = () => {
  return (
    <Box>
      <AppBar position="static" sx={styles.appBar}>
        <Toolbar>
          <ReactRouterLink to="/" style={{ display: 'flex' }} role="link">
            <img src="/assets/images/logo.svg" alt="Velocity" />
          </ReactRouterLink>
        </Toolbar>
      </AppBar>
      <Box sx={styles.container}>
        <Typography variant="h3" mb="30px">
          REGISTRAR UI PRIVACY POLICY
        </Typography>
        <Typography textTransform="uppercase" variant="pm">
          Last updated: December 2022
        </Typography>
        <Typography paragraph mt="51px">
          <Box component="span">
            This Policy is designed to apply to the Registrar UI as available online on
            Velocity&rsquo;s Registrar UI website <br />
            https://registrarapp.velocitynetwork.foundation/ (the &ldquo;
          </Box>
          <Box fontWeight="fontWeightBold" display="inline" component="b">
            Site
          </Box>
          <Box component="span">&rdquo;).</Box>
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          Identity and contact details of the controller and Data Privacy officer
        </Typography>
        <Typography paragraph>
          <Box component="span">Velocity Network Foundation, Inc. and its affiliates (&ldquo;</Box>
          <Box component="span" sx={styles.bold}>
            Velocity
          </Box>
          <Box component="span">&rdquo; or &ldquo;</Box>
          <Box component="span" sx={styles.bold}>
            we
          </Box>
          <Box component="span">&rdquo; or &ldquo;</Box>
          <Box component="span" sx={styles.bold}>
            us
          </Box>
          <Box component="span">&rdquo; or &ldquo;</Box>
          <Box component="span" sx={styles.bold}>
            our
          </Box>
          <Box component="span">
            &rdquo;), as controller of personal data, is responsible for the processing of personal
            data that relates to you (&ldquo;
          </Box>
          <Box component="span" sx={styles.bold}>
            you
          </Box>
          <Box component="span">&rdquo; or &ldquo;</Box>
          <Box component="span" sx={styles.bold}>
            User
          </Box>
          <Box component="span">
            &rdquo;) under applicable data protection laws and regulations.
          </Box>
        </Typography>
        <Typography paragraph>
          If you have questions regarding the processing of your personal data, please contact
          Velocity&rsquo;s data privacy officer at&nbsp;
          <Link href="mailto:DataOfficer@VelocityNetwork.Foundation">
            DataOfficer@VelocityNetwork.Foundation
          </Link>
          .
        </Typography>
        <Typography paragraph marginBottom="0px">
          For the purposes of this Privacy Policy, &ldquo;
          <Box component="span" sx={styles.bold}>
            personal data
          </Box>
          &rdquo; is any information about a specific individual or that identifies or may identify
          a specific individual. In other words, it is any piece of information than can be linked
          to you.
        </Typography>
        <Typography paragraph marginTop="0px">
          The term &quot;process&rdquo; or &ldquo;processing&rdquo; means any use of personal data,
          including but not limited to the collection, recording, organization, storing, adaptation,
          alteration, transferring, making available, blocking, deletion or destruction of personal
          data.
        </Typography>
        <Typography variant="h4" sx={styles.subtitle}>
          Our Role as a Data Controller
        </Typography>
        <Typography paragraph>
          Velocity acts in the capacity of a data controller with regard to the Personal Data
          processed through the Registrar UI (the &ldquo;
          <Box component="span" sx={styles.bold}>
            Service
          </Box>
          &rdquo;), as well as the Career Wallet Service (as defined in the Career Wallet App
          Privacy Policy) in terms of the applicable data protection laws, including the EU General
          Data Protection Regulation (GDPR). This privacy policy does not apply to the Career Wallet
          Service, to which the Career Wallet App Privacy Policy applies.
        </Typography>
        <Typography paragraph>
          We are responsible for the collection, usage and processing of your personal data
          collected through the Site (the &ldquo;
          <Box component="span" sx={styles.bold}>
            Service Data
          </Box>
          &rdquo;). The Service Data may include information such as name, email, telephone number,
          payment details, including information you provide us of your employees, agents, vendors
          etc., for providing our services to You. We make decisions about the types of personal
          data that should be collected from you and purposes for which such personal data should be
          used. Therefore, we act as a data controller with regard to the Service data. This Privacy
          Policy applies to such processing.
        </Typography>
        <Typography>
          <Box component="span" sx={styles.bold}>
            Separate Controllers
          </Box>
          . Additionally, Velocity and User are separately responsible for the Personal Data of the
          Velocity Career Wallet end users (&ldquo;
          <Box component="span" sx={styles.bold}>
            Wallet Holders
          </Box>
          &rdquo;) collected, shared and processed by Velocity and User and its further use through
          the Wallet Service. As mentioned above, this Privacy Policy does not apply to such
          processes. Please review the terms described in the Verification Service User Agreement
          for further details.
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          Changes in the Policy
        </Typography>
        <Typography paragraph>
          We reserve all rights to adjust this Privacy Policy at any time and for any reason. You
          will be made aware of such an adjustment by reference to a change in the &ldquo;Last
          updated&rdquo; date of this Privacy Policy (referenced above). You are encouraged to
          periodically review this Privacy Policy to stay informed of any updates or changes. You
          will be deemed to have been made aware of, will be subject to, and to have accepted the
          changes in any revised Privacy Policy by your continued use of the Site after the date
          such updated Privacy Policy is posted here.
        </Typography>
        <Typography paragraph variant="h3" sx={styles.subtitle} mb="30px">
          COLLECTION OF YOUR SERVICE DATA
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          Types and Purposes of Service Data
        </Typography>
        <Typography paragraph>
          We use Service Data for limited, specified and legitimate purposes explicitly mentioned in
          this Privacy Policy. When processing personal data, we make sure that we do so by relying
          on one of the available legal bases under applicable data protection laws, as described
          herein:
        </Typography>
        <List sx={styles.list}>
          <ListItem sx={styles.listItem}>
            <Box component="span" sx={styles.bold}>
              Contact Details
            </Box>
            . When you sign up on the Site, we collect some information about You and your contact
            persons which include full name, email address, and password. We use such information to
            register you, contact you (if necessary) and maintain our business records. The legal
            bases on which we rely are &lsquo;performance of a contract&rsquo; and &lsquo;pursuing
            our legitimate interests&rsquo; (to administer Velocity&rsquo;s business).{' '}
          </ListItem>
          <ListItem sx={styles.listItem}>
            <Box component="span" sx={styles.bold}>
              Inquiries
            </Box>
            . When you contact us by any mean available, we collect your full name, email address,
            and any information that you decide to include in your message. We have no control over
            the information you decide to provide in your message, and we advise you not to share
            sensitive Personal Data. If provide you information about others, it is your
            responsibility to have their proper consent. We use such data to respond to your
            inquiries. The legal basis on which we rely is &lsquo;pursuing our legitimate
            interests&rsquo;.
          </ListItem>
          <ListItem sx={styles.listItem}>
            <Box component="span" sx={styles.bold}>
              Payment processing
            </Box>
            . When you make a payment, we collect your full name, email address, organization,
            country, billing address, and payment information (name on your card, card number, and
            expiration date). We use such data to process your payment, provide you with the
            requested services, contact you (if necessary), and keep our business records. The legal
            bases on which we rely are &lsquo;performance of a contract&rsquo; with you and
            &lsquo;pursuing our legitimate business interests&rsquo; (i.e., to administer our
            business and comply with the applicable laws).{' '}
          </ListItem>
        </List>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          HOW WE MAY SHARE SERVICE DATA
        </Typography>
        <Typography paragraph>
          Velocity may share your Personal Data it has collected about you in certain situations,
          for the specified purposes set out above. Your Personal Data may be disclosed with third
          parties such as Velocity&rsquo;s suppliers, including companies and suppliers outside the
          EU/EEA.
        </Typography>
        <Typography paragraph>
          Part of our third-party suppliers consists of suppliers that facilitate us with the usage
          and performance of our Site which includes monitoring of traffic and analytics within the
          Site through the use of cookies and other similar technologies. For further information
          regarding the usage of cookies refer to our{' '}
          <Link
            sx={styles.link}
            // eslint-disable-next-line max-len
            href="https://www.google.com/url?q=https://www.velocitycareerlabs.com/cookies&amp;sa=D&amp;source=editors&amp;ust=1678103921266161&amp;usg=AOvVaw10nOumNzNSR0c2ET1SbBWH"
          >
            Velocity Career Labs Cookie Policy
          </Link>
          .
        </Typography>
        <Typography paragraph>
          In particular, we use Google Analytics. For further details on the way Google uses
          personal information see the link &ldquo;
          <Link
            sx={styles.link}
            // eslint-disable-next-line max-len
            href="https://www.google.com/url?q=https://policies.google.com/technologies/partner-sites&amp;sa=D&amp;source=editors&amp;ust=1678103921266696&amp;usg=AOvVaw2gk6GX4UYXYo1WrV_MZVX8"
          >
            How Google uses data when you use our partners&rsquo; sites or apps
          </Link>
          &rdquo;.
        </Typography>
        <Typography paragraph>
          In the event we will transfer Service Data to our third-party suppliers that are located
          outside of the EU/EEA, and if required under applicable law, Velocity will ensure the
          implementation of appropriate safeguards in place to provide adequate level of protection
          to the Service Data in accordance with the applicable data protection laws (including the
          EU General Data Protection Regulation &ndash; &lsquo;
          <Box component="span" sx={styles.bold}>
            GDPR
          </Box>
          &rsquo;). For example, this may include the use of EU approved Standard Contractual
          Clauses or such other mechanism as have been recognized or approved by the relevant
          authorities from time to time. We will disclose Personal Data to comply with any court
          order, law or legal process, including to respond to any government or regulatory request.
        </Typography>
        <Typography paragraph>
          Finally, if we ever sell Velocity, or participate in a merger or consolidation, Service
          Data may be transferred accordingly.
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          FOR HOW LONG WILL VELOCITY KEEP THE SERVICE DATA?
        </Typography>
        <Typography paragraph>
          Velocity will retain Service Data only for as long as needed for the purpose of providing
          you the Service After this period, Velocity will only process Service Data as may be
          required to comply with local legal obligations or to satisfy any legal requirements in
          the event of an actual, threatened or anticipated dispute or claim.
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          YOUR DATA PROTECTION RIGHTS
        </Typography>
        <Typography>
          You may be entitled, where provided for under applicable data protection laws and
          regulations, to:
        </Typography>
        <List sx={styles.list}>
          <ListItem sx={styles.listItem}>
            Request access to the Service Data Velocity processes about you: this right entitles you
            to know whether we hold personal data about you and, if we do, to obtain information on
            and a copy of the specific pieces and categories of personal data.
          </ListItem>
          <ListItem sx={styles.listItem}>
            Request a rectification of your Service Data: this right entitles you to have your
            Service Data corrected if it is inaccurate or incomplete.
          </ListItem>
          <ListItem sx={styles.listItem}>
            Object to the processing of your Service Data: this right entitles you to request that
            Velocity no longer process your Service Data.
          </ListItem>
          <ListItem sx={styles.listItem}>
            In certain situations, as it may be applied in the applicable data protection law, and
            when you wish to terminate your account, you can request the erasure or deletion of your
            Service Data: this right entitles you to request the erasure or deletion of your Service
            Data.
          </ListItem>
          <ListItem sx={styles.listItem}>
            Request the restriction of the processing of your Service Data: this right entitles you
            to request that Velocity processes your Service Data only in limited circumstances.
          </ListItem>
          <ListItem sx={styles.listItem}>
            Request portability of your Service Data: this right entitles you to receive a copy (in
            a portable and, if technically feasible, readily usable format) of your Service Data.
          </ListItem>
          <ListItem sx={styles.listItem}>
            In the event that our processing of your Service Data or part thereof is based on your
            consent, to withdraw at any time your consent, in which case Velocity will cease any
            further processing activities of your Service Data or the relevant part thereof (however
            such withdrawal will not affect the legality of the data processing activities prior to
            the withdrawal). Please note that Velocity may not always be obliged to comply with a
            request of deletion, restriction, objection or data portability. Assessment may be made
            on a case-by-case basis of Velocity&rsquo;s legal obligations and the exception to such
            rights.
          </ListItem>
        </List>
        <Typography paragraph>
          You also have the right to lodge any complaints you may have regarding Velocity&rsquo;s
          processing of your Service Data to a supervisory authority. For more information about
          these rights and how to exercise them, please contact the Velocity Privacy Officer via the
          contact details set out above.
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          HOW DOES VELOCITY SAFEGUARD THE SERVICE DATA
        </Typography>
        <Typography paragraph>
          Velocity utilizes appropriate and reasonable legal, technical and organizational security
          measures, including information technology security and physical security measures, to
          adequately protect the Service Data.
        </Typography>
        <Typography paragraph>
          These measures are appropriate to the risks posed by the processing of the Service Data
          and to the sensitivity of the Service Data and take into account the requirements of
          applicable local law. In addition, the measures are continuously improved in line with the
          development of available security products and services.
        </Typography>
        <Typography paragraph>
          Velocity requires all persons to abide by applicable security policies related to personal
          data when using Velocity systems.&nbsp;
        </Typography>
        <Typography paragraph variant="h4" sx={styles.subtitle}>
          CONTACT US
        </Typography>
        <Typography paragraph>
          If you have questions or comments about this Privacy Policy, please contact us at:{' '}
          <Link href="mailto:DataOfficer@VelocityNetwork.Foundation">
            DataOfficer@VelocityNetwork.Foundation
          </Link>
          .
        </Typography>
      </Box>
    </Box>
  );
};

const styles = {
  container: {
    pt: '62px',
    pb: `calc(90px + ${FOOTER_HEIGHT})`,
    ml: '80px',
    maxWidth: '67.71%',
    textAlign: 'justify',
    color: theme.palette.text.primary,
  },
  subtitle: {
    mt: '50px',
    mb: '20px',
  },
  bold: {
    fontWeight: '700',
  },
  list: {
    listStyleType: 'disc',
    marginLeft: '21px',
    padding: 0,
  },
  listItem: {
    display: 'list-item',
    padding: '8px 0 8px 5px',
    textAlign: 'justify',
    lineHeight: 1.5,
  },
  appBar: {
    boxShadow: 'none',
    backgroundColor: 'transparent',
    minHeight: '79px',
    display: 'flex',
    justifyContent: 'center',
  },
};

export default PrivacyPolicy;
