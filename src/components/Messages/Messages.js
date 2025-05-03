import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loadFromServer } from '../../utils/storage';
import './Messages.css';

const Messages = () => {
  const [userData, setUserData] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ type: 'info', text: 'Please sign in to view your message' });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState(null);
  const [searchEmail, setSearchEmail] = useState('');
  const navigate = useNavigate();

  // Initialize Google Sign-In
  useEffect(() => {
    // Handle Google Sign-In response - defined inside useEffect to avoid dependency issues
    const handleCredentialResponseInside = async (response) => {
      try {
        // Decode the JWT token to get user information
        const responsePayload = parseJwt(response.credential);
        
        console.log("Sign-in successful:", responsePayload.email);
        
        // Save user info immediately
        const email = responsePayload.email;
        const normalizedEmail = email.toLowerCase();
        
        setUserEmail(email);
        setUserInfo({
          name: responsePayload.name,
          email: email,
          picture: responsePayload.picture
        });
        setIsLoggedIn(true);
        setSearchEmail(email);  // Keep for API compatibility
        
        // Start loading data immediately
        setStatusMessage({
          type: 'info',
          text: 'Retrieving your message...'
        });
        
        try {
          // Load data directly from server
          const serverData = await loadFromServer(normalizedEmail);
          
          if (serverData && Array.isArray(serverData) && serverData.length > 0) {
            // Find exact match
            const matchingData = serverData.find(item => 
              item.email && item.email.toLowerCase() === normalizedEmail
            );
            
            if (matchingData) {
              displayMessage(matchingData);
              setUserData([matchingData]);
              setStatusMessage({
                type: 'success',
                text: 'Message retrieved successfully.'
              });
              return;
            }
          }
          
          // No data found
          setMessage({
            error: true,
            text: `No message found for your email address (${normalizedEmail}).`
          });
          setStatusMessage({
            type: 'warning',
            text: 'No matching message found.'
          });
        } catch (error) {
          console.error("Error loading message:", error);
          setMessage({
            error: true,
            text: 'Error retrieving your message. Please try refreshing the page.'
          });
          setStatusMessage({
            type: 'error',
            text: 'Error retrieving message.'
          });
        }
      } catch (error) {
        console.error("Error processing sign-in:", error);
        setStatusMessage({
          type: 'error',
          text: 'Sign-in error. Please try again.'
        });
      }
    };

    // Load the Google Sign-In API
    const loadGoogleSignIn = () => {
      window.google?.accounts?.id.initialize({
        client_id: '626577637781-nt3mc0gim7o2f0rpd09j6rak82t4vtps.apps.googleusercontent.com',
        callback: handleCredentialResponseInside,
      });
      
      window.google?.accounts?.id.renderButton(
        document.getElementById('google-signin-button'),
        { theme: 'outline', size: 'large' }
      );
    };

    // Check if Google API is already loaded
    if (window.google && window.google.accounts) {
      loadGoogleSignIn();
    } else {
      // Add Google API script if not loaded
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = loadGoogleSignIn;
      document.body.appendChild(script);
      
      return () => {
        document.body.removeChild(script);
      };
    }
  }, []);  // No external dependencies now since handleCredentialResponse is inside

  // Parse JWT token
  const parseJwt = (token) => {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  };

  // Function to load data from server
  const loadDataFromServer = async () => {
    setStatusMessage({
      type: 'info',
      text: 'Retrieving your messages...'
    });

    try {
      // Only proceed if we have a user email from sign-in
      if (!userEmail) {
        return null;
      }
      
      // Normalize email to lowercase
      const normalizedEmail = userEmail.toLowerCase();
      
      // First check if we already have data loaded in userData for this email
      if (userData && Array.isArray(userData)) {
        const existingData = userData.filter(item => 
          item.email && item.email.toLowerCase() === normalizedEmail
        );
        
        if (existingData.length > 0) {
          console.log("Using already loaded data");
          return existingData;
        }
      }
      
      // Load data directly from the server
      console.log("Loading message for:", normalizedEmail);
      const serverData = await loadFromServer(normalizedEmail);
      
      if (serverData && Array.isArray(serverData) && serverData.length > 0) {
        // Verify the data is for this user by checking email match
        const matchingData = serverData.filter(item => 
          item.email && item.email.toLowerCase() === normalizedEmail
        );
        
        if (matchingData.length > 0) {
          // Save matching data
          setUserData(matchingData);
          showSuccessMessage(`Message retrieved successfully.`);
          return matchingData;
        }
      }
      
      // No data found
      setUserData([]);
      return null;
    } catch (error) {
      console.error("Error loading data:", error);
      setUserData([]);
      return null;
    }
  };

  const showSuccessMessage = (text) => {
    setStatusMessage({
      type: 'success',
      text: text || 'Your message has been retrieved successfully.'
    });
  };

  const showWarningMessage = (text) => {
    setStatusMessage({
      type: 'warning',
      text: text || 'No matching data found.'
    });
  };

  const showErrorMessage = (text) => {
    setStatusMessage({
      type: 'error-text',
      text: text || 'Error: Could not retrieve your message.'
    });
  };

  // Handle search button click
  const handleSearch = async () => {
    const emailInput = searchEmail.trim().toLowerCase();
    
    // Must have a signed-in user
    if (!userEmail) {
      setMessage({
        error: true,
        text: 'Please sign in with your Google account first.'
      });
      return;
    }
    
    const normalizedUserEmail = userEmail.toLowerCase();
    
    // Check if the entered email matches the signed-in email
    if (emailInput && emailInput !== normalizedUserEmail) {
      setMessage({
        error: true,
        text: `Access denied: You can only view messages sent to your own email address. The email you entered (${emailInput}) does not match your Google Sign-In email (${normalizedUserEmail}).`
      });
      return;
    }
    
    // If email is empty but we have userEmail, use that
    if (!emailInput) {
      setSearchEmail(normalizedUserEmail);
      await searchMessage(normalizedUserEmail);
      return;
    }
    
    // At this point, emailInput and userEmail should match, so we can search
    await searchMessage(emailInput);
  };

  const searchMessage = async (email) => {
    if (!email) {
      setMessage({
        error: true,
        text: 'Email address is required.'
      });
      return;
    }
    
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();
    
    // Ensure entered email matches Google account email
    if (normalizedEmail !== userEmail.toLowerCase()) {
      setMessage({
        error: true,
        text: 'Access denied: You can only view messages sent to your own email address.'
      });
      return;
    }
    
    try {
      // First try to use data we already have loaded
      let matchingData = null;
      
      // Check if we already have matching data in userData from previous load
      if (userData && userData.length > 0) {
        matchingData = userData.find(record => 
          record.email && record.email.toLowerCase() === normalizedEmail
        );
        
        if (matchingData) {
          console.log("Using cached data for message display");
          displayMessage(matchingData);
          return;
        }
      }
      
      // If we don't have data yet, load it from server
      const loadedData = await loadDataFromServer();
      
      if (loadedData && Array.isArray(loadedData) && loadedData.length > 0) {
        // Find matching record
        matchingData = loadedData.find(record => 
          record.email && record.email.toLowerCase() === normalizedEmail
        );
        
        if (matchingData) {
          displayMessage(matchingData);
          return;
        }
      }
      
      // No matching data found
      setMessage({
        error: true,
        text: `No message found for your email address (${normalizedEmail}).`
      });
      
    } catch (error) {
      console.error("Error searching for message:", error);
      setMessage({
        error: true,
        text: `Error retrieving message. Please try again.`
      });
    }
  };

  const displayMessage = (student) => {
    // Create the message using the template, handle empty fields gracefully
    const nameValue = student.name ? student.name : '[Name not provided]';
    const emailValue = student.email ? student.email : userEmail; // Use Google email if not provided
    
    // Store report link exactly as-is without any modification
    const reportLinkValue = student.reportLink ? student.reportLink : '[Report link not provided]';
    
    const passwordValue = student.password ? student.password : '[Password not provided]';
    
    // Get upload information
    const uploadInfo = student.uploadInfo || null;
    const createdAt = student.createdAt ? new Date(student.createdAt).toLocaleString() : null;
    const source = student.source || (uploadInfo ? 'excel_upload' : 'unknown');
    
    // Create a simplified text version for clipboard copying
    const plainTextMessage = `Dear ${nameValue},
Greetings from FACE Prep!
email id : ${emailValue}
Thank you for attending the VISION Test.
Please find your test report and password below:

Report Link: ${reportLinkValue}
Password: ${passwordValue}

Wishing you the very best for your future endeavors!

Regards,
FACE Prep Team`;
    
    setMessage({
      error: false,
      text: plainTextMessage,
      name: nameValue,
      email: emailValue,
      reportLink: reportLinkValue,
      password: passwordValue,
      uploadInfo: uploadInfo,
      createdAt: createdAt,
      source: source,
      copyable: true
    });
  };

  // Copy message functionality
  const copyMessage = () => {
    navigator.clipboard.writeText(message.text)
      .then(() => {
        const copyButton = document.querySelector('.copy-button');
        copyButton.textContent = 'Copied!';
        
        setTimeout(() => {
          copyButton.textContent = 'Copy Message';
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
        alert('Failed to copy message. Please try again.');
      });
  };

  // Copy password functionality
  const copyPassword = () => {
    if (!message || !message.password) return;
    
    navigator.clipboard.writeText(message.password)
      .then(() => {
        const passwordElement = document.querySelector('.password-value');
        passwordElement.classList.add('copied');
        
        setTimeout(() => {
          passwordElement.classList.remove('copied');
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy password: ', err);
        alert('Failed to copy password. Please try again.');
      });
  };

  // Open report link
  const openReportLink = (e) => {
    // Prevent default if this is an event
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!message || !message.reportLink || message.reportLink === '[Report link not provided]') {
      alert('Report link not available');
      return;
    }
    
    try {
      // Get the exact link without modifications
      let exactLink = message.reportLink.trim();
      
      // Ensure the link has a protocol (http or https)
      // If no protocol is specified, add https://
      if (!exactLink.startsWith('http://') && !exactLink.startsWith('https://')) {
        exactLink = 'https://' + exactLink;
      }
      
      // Open the link as-is in a new tab without any domain prefix
      window.open(exactLink, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening link:', error);
      alert('Could not open the report link. Please try again.');
    }
  };

  return (
    <div className="messages-page">
      <div className="messages-container">
        
        {statusMessage && (
          <div className={`status-message ${statusMessage.type}`}>
            {statusMessage.text}
          </div>
        )}

        {!isLoggedIn ? (
          <div className="login-container">
            <div className="login-content">
              <h2>Access Your FACE Prep Message</h2>
              
              <div className="login-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Sign in with your Google Account</h3>
                  <p>Use the same email address that was provided during registration</p>
                </div>
              </div>
              
              <div className="login-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>View Your Message</h3>
                  <p>After signing in, your personalized message will be displayed automatically</p>
                </div>
              </div>
              
              <div className="login-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Access Report Details</h3>
                  <p>Your message contains the report link and password needed to view your test results</p>
                </div>
              </div>
              
              <div id="google-signin-button" className="google-signin-button"></div>
              
              <div className="login-note">
                <p>Having trouble? Contact support at support@faceprep.in</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {userInfo && (
              <div className="user-info">
                <img src={userInfo.picture} alt={userInfo.name} className="user-avatar" />
                <div>
                  <div className="user-name">{userInfo.name}</div>
                  <div className="user-email">{userInfo.email}</div>
                </div>
              </div>
            )}

            {message && !message.error && (
              <div className="message-card">
                <div className="message-content">
                  <p>Dear {message.name},</p>
                  <p>Greetings from FACE Prep!</p>
                  <p>email id: {message.email}</p>
                  <p>Thank you for attending the VISION Test.</p>
                  <p>Please find your test report and password below:</p>
                  
                  <div className="message-details">
                    <div className="detail-row">
                      <span className="detail-label">Report Link:</span>
                      <span 
                        className="detail-value report-link-value" 
                        onClick={openReportLink}
                        title="Click to open report"
                      >
                        {message.reportLink}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Password:</span>
                      <span 
                        className="detail-value password-value" 
                        onClick={copyPassword}
                        title="Click to copy password"
                      >
                        {message.password}
                      </span>
                    </div>
                  </div>
                  
                  <p>Wishing you the very best for your future endeavors!</p>
                  <p>Regards,<br/>FACE Prep Team</p>
                </div>
                <button className="copy-button" onClick={copyMessage}>Copy Message</button>
              </div>
            )}

            {message && message.error && (
              <div className="no-results">
                <div className="error-text">{message.text}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Messages; 